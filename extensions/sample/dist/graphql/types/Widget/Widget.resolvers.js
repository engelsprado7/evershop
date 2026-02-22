/**
 * Overrides basicMenuWidget so the "Shop" menu item shows all categories
 * that have "Include in Menu" enabled, not just the ones saved in widget settings.
 */ import { select, value } from '@evershop/postgres-query-builder';
import uniqid from 'uniqid';
import { buildUrl } from '@evershop/evershop/lib/router';
/** Fetch all categories with Include in Menu = Yes (same as Menu query) */ async function getMenuCategories(pool) {
    const query = select('name').select('uuid').select('request_path').from('category', 'cat');
    query.leftJoin('category_description', 'des').on('cat.category_id', '=', 'des.category_description_category_id');
    query.leftJoin('url_rewrite', 'url').on('url.entity_uuid', '=', 'cat.uuid').and('url.entity_type', '=', value('category'));
    query.where('cat.status', '=', 1).and('cat.include_in_nav', '=', 1).and('des.url_key', 'IS NOT NULL', null).and('des.url_key', '!=', '');
    const rows = await query.execute(pool);
    return rows.map((i)=>({
            name: i.name,
            url: i.request_path || buildUrl('categoryView', {
                uuid: i.uuid
            }),
            type: 'custom',
            uuid: i.uuid,
            id: uniqid()
        }));
}
export default {
    Query: {
        basicMenuWidget: async (_, { settings }, { pool })=>{
            const menus = settings?.menus || undefined;
            const isMain = [
                1,
                '1',
                'true',
                true
            ].includes(settings?.isMain) || false;
            if (!menus) {
                return {
                    menus: [],
                    isMain,
                    className: settings?.className
                };
            }
            const shopCategories = await getMenuCategories(pool);
            const categories = [];
            const pages = [];
            for (const menu of menus){
                if (menu.name === 'Shop') continue;
                if (menu.type === 'category') categories.push(menu.uuid);
                if (menu.type === 'page') pages.push(menu.uuid);
                for (const child of menu.children || []){
                    if (child.type === 'category') categories.push(child.uuid);
                    if (child.type === 'page') pages.push(child.uuid);
                }
            }
            let urls = [];
            if (categories.length > 0) {
                const rewrites = await select().from('url_rewrite').where('entity_uuid', 'IN', categories).execute(pool);
                urls = urls.concat(rewrites.map((r)=>({
                        uuid: r.entity_uuid,
                        url: r.request_path
                    })));
            }
            if (pages.length > 0) {
                const pageQuery = select('cms_page.uuid').select('cms_page_description.url_key').from('cms_page').leftJoin('cms_page_description').on('cms_page.cms_page_id', '=', 'cms_page_description.cms_page_description_cms_page_id').where('cms_page.uuid', 'IN', pages);
                const cmsPages = await pageQuery.execute(pool);
                urls = urls.concat(cmsPages.map((p)=>({
                        uuid: p.uuid,
                        url: buildUrl('cmsPageView', {
                            url_key: p.url_key
                        })
                    })));
            }
            const items = menus.map((menu)=>{
                const url = urls.find((u)=>u.uuid === menu.uuid);
                const isShop = menu.name === 'Shop';
                const children = isShop ? shopCategories : (menu.children || []).map((child)=>{
                    const childUrl = urls.find((u)=>u.uuid === child.uuid);
                    return {
                        ...child,
                        id: uniqid(),
                        url: childUrl ? childUrl.url : child.type === 'custom' ? child.url : null
                    };
                });
                return {
                    ...menu,
                    id: uniqid(),
                    url: url ? url.url : menu.type === 'custom' ? menu.url : null,
                    children
                };
            });
            return {
                menus: items,
                isMain,
                className: settings?.className
            };
        }
    }
};
