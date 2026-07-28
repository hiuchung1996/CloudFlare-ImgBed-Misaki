import { getDatabase } from '../../../utils/databaseAdapter.js';

export async function onRequest(context) {
    // 頁面設置相關，GET方法讀取設置，POST方法保存設置
    const {
        request, // same as existing Worker API
        env, // same as existing Worker API
        params, // if filename includes [id] or [[path]]
        waitUntil, // same as ctx.waitUntil in existing Worker API
        next, // used for middleware or to fetch assets
        data, // arbitrary space for passing data between middlewares
    } = context;

    const db = getDatabase(env);

    // GET讀取設置
    if (request.method === 'GET') {
        const settings = await getPageConfig(db, env)

        return new Response(JSON.stringify(settings), {
            headers: {
                'content-type': 'application/json',
            },
        })
    }

    // POST保存設置
    if (request.method === 'POST') {
        const body = await request.json()
        const previousSettings = await getPageConfig(db, env)
        const settings = processAnnouncementInfo(body, previousSettings)

        // 寫入數據庫
        await db.put('manage@sysConfig@page', JSON.stringify(settings))

        return new Response(JSON.stringify(settings), {
            headers: {
                'content-type': 'application/json',
            },
        })
    }

}

export async function getPageConfig(db, env) {
    const settings = {}
    // 讀取數據庫中的設置
    const settingsStr = await db.get('manage@sysConfig@page')
    const settingsKV = settingsStr ? JSON.parse(settingsStr) : {}

    if (Number.isFinite(Number(settingsKV.announcementRefreshAt))) {
        settings.announcementRefreshAt = Number(settingsKV.announcementRefreshAt)
    }

    const config = []
    settings.config = config
    config.push(
        // 全局設置
        {
            id: 'siteTitle',
            label: '網站標題',
            label_en: 'Site Title',
            placeholder: 'Sanyue ImgHub',
            category: '全局設置',
            category_en: 'Global Settings',
        },
        {
            id: 'siteIcon',
            label: '網站圖標',
            label_en: 'Site Icon',
            category: '全局設置',
            category_en: 'Global Settings',
        },
        {
            id: 'ownerName',
            label: '圖床名稱',
            label_en: 'Site Name',
            placeholder: 'Sanyue ImgHub',
            category: '全局設置',
            category_en: 'Global Settings',
        },
        {
            id: 'logoUrl',
            label: '圖床Logo',
            label_en: 'Site Logo',
            category: '全局設置',
            category_en: 'Global Settings',
        },
        {
            id: 'logoLink',
            label: 'Logo跳轉鏈接',
            label_en: 'Logo Link',
            placeholder: 'https://github.com/MarSeventh/CloudFlare-ImgBed',
            tooltip: '點擊Logo時跳轉的鏈接，留空則使用默認GitHub鏈接',
            tooltip_en: 'URL to navigate when clicking the logo. Leave empty for default GitHub link',
            category: '全局設置',
            category_en: 'Global Settings',
        },
        {
            id: 'bkInterval',
            label: '背景切換間隔',
            label_en: 'Background Interval',
            placeholder: '3000',
            tooltip: '單位：毫秒 ms',
            tooltip_en: 'Unit: milliseconds (ms)',
            category: '全局設置',
            category_en: 'Global Settings',
        },
        {
            id: 'bkOpacity',
            label: '背景圖透明度',
            label_en: 'Background Opacity',
            placeholder: '1',
            tooltip: '0-1 之間的小數',
            tooltip_en: 'Decimal between 0 and 1',
            category: '全局設置',
            category_en: 'Global Settings',
        },
        {
            id: 'wallpaperEnabled',
            label: '啓用壁紙',
            label_en: 'Enable Wallpaper',
            type: 'boolean',
            default: true,
            tooltip: '控制所有頁面的背景壁紙開關，關閉後將使用純色背景',
            tooltip_en: 'Toggle background wallpaper across all pages. When off, a solid color background will be used',
            category: '全局設置',
            category_en: 'Global Settings',
        },
        {
            id: 'urlPrefix',
            label: '默認URL前綴',
            label_en: 'Default URL Prefix',
            tooltip: '自定義URL前綴，如：https://img.a.com/file/，留空則使用當前域名 <br/> 設置後將應用於客户端和管理端',
            tooltip_en: 'Custom URL prefix, e.g. https://img.a.com/file/. Leave empty to use current domain <br/> Applies to both client and admin',
            category: '全局設置',
            category_en: 'Global Settings',
        },
        // 客户端設置
        {
            id: 'announcement',
            label: '公告',
            label_en: 'Announcement',
            type: 'textarea',
            tooltip: '支持HTML標籤',
            tooltip_en: 'Supports HTML tags',
            category: '客户端設置',
            category_en: 'Client Settings',
        },
        {
            id: 'showDirectorySuggestions',
            label: '目錄候選項',
            label_en: 'Directory Suggestions',
            type: 'boolean',
            default: true,
            tooltip: '控制上傳頁面是否展示目錄樹選擇器',
            tooltip_en: 'Show directory tree picker on upload page',
            category: '客户端設置',
            category_en: 'Client Settings',
        },
        {
            id: 'defaultUploadChannel',
            label: '默認渠道類型',
            label_en: 'Default Channel Type',
            type: 'select',
            options: [
                { label: 'Telegram', value: 'telegram' },
                { label: 'Cloudflare R2', value: 'cfr2' },
                { label: 'S3', value: 's3' },
                { label: 'Discord', value: 'discord' },
                { label: 'HuggingFace', value: 'huggingface' },
                { label: 'WebDAV', value: 'webdav' },
            ],
            placeholder: 'telegram',
            category: '客户端設置',
            category_en: 'Client Settings',
        },
        {
            id: 'defaultChannelName',
            label: '默認渠道名稱',
            label_en: 'Default Channel Name',
            type: 'channelName',
            tooltip: '指定默認使用的渠道名稱，需先選擇上傳渠道',
            tooltip_en: 'Specify default channel name. Select upload channel first',
            category: '客户端設置',
            category_en: 'Client Settings',
        },
        {
            id: 'defaultUploadFolder',
            label: '默認上傳目錄',
            label_en: 'Default Upload Directory',
            placeholder: '/ 開頭的合法目錄，不能包含特殊字符， 默認為根目錄',
            placeholder_en: 'Valid path starting with /, no special chars. Default: root',
            category: '客户端設置',
            category_en: 'Client Settings',
        },
        {
            id: 'defaultUploadNameType',
            label: '默認命名方式',
            label_en: 'Default Naming',
            type: 'select',
            options: [
                { label: '默認', value: 'default', label_en: 'Default' },
                { label: '僅前綴', value: 'index', label_en: 'Prefix Only' },
                { label: '僅原名', value: 'origin', label_en: 'Original Name' },
                { label: '短鏈接', value: 'short', label_en: 'Short Link' },
            ],
            placeholder: 'default',
            category: '客户端設置',
            category_en: 'Client Settings',
        },
        {
            id: 'defaultConvertToWebp',
            label: '默認轉換WebP',
            label_en: 'Default Convert to WebP',
            type: 'boolean',
            default: false,
            tooltip: '上傳前將圖片轉換為WebP格式，可有效減小文件體積',
            tooltip_en: 'Convert images to WebP before upload to reduce file size',
            category: '客户端設置',
            category_en: 'Client Settings',
        },
        {
            id: 'defaultCustomerCompress',
            label: '默認開啓壓縮',
            label_en: 'Default Compression',
            type: 'boolean',
            default: true,
            tooltip: '上傳前在本地進行壓縮，僅對圖片文件生效',
            tooltip_en: 'Compress locally before upload, only for images',
            category: '客户端設置',
            category_en: 'Client Settings',
        },
        {
            id: 'defaultCompressBar',
            label: '默認壓縮閾值',
            label_en: 'Default Compress Threshold',
            placeholder: '5',
            tooltip: '圖片大小超過此值將自動壓縮，單位MB，範圍1-20',
            tooltip_en: 'Auto-compress when image exceeds this size (MB), range 1-20',
            category: '客户端設置',
            category_en: 'Client Settings',
        },
        {
            id: 'defaultCompressQuality',
            label: '默認壓縮期望',
            label_en: 'Default Compress Target',
            placeholder: '4',
            tooltip: '壓縮後圖片大小期望值，單位MB，範圍0.5-壓縮閾值',
            tooltip_en: 'Target image size after compression (MB), range 0.5 to threshold',
            category: '客户端設置',
            category_en: 'Client Settings',
        },
        {
            id: 'loginBkImg',
            label: '登錄頁背景圖',
            label_en: 'Login Background',
            tooltip: '1.填寫 bing 使用必應壁紙輪播 <br/> 2.填寫 ["url1","url2"] 使用多張圖片輪播 <br/> 3.填寫 ["url"] 使用單張圖片',
            tooltip_en: '1. Enter "bing" for Bing wallpaper rotation <br/> 2. Enter ["url1","url2"] for multiple images <br/> 3. Enter ["url"] for a single image',
            category: '客户端設置',
            category_en: 'Client Settings',
        },
        {
            id: 'uploadBkImg',
            label: '上傳頁背景圖',
            label_en: 'Upload Background',
            tooltip: '1.填寫 bing 使用必應壁紙輪播 <br/> 2.填寫 ["url1","url2"] 使用多張圖片輪播 <br/> 3.填寫 ["url"] 使用單張圖片',
            tooltip_en: '1. Enter "bing" for Bing wallpaper rotation <br/> 2. Enter ["url1","url2"] for multiple images <br/> 3. Enter ["url"] for a single image',
            category: '客户端設置',
            category_en: 'Client Settings',
        },
        {
            id: 'footerLink',
            label: '頁腳傳送門鏈接',
            label_en: 'Footer Portal Link',
            category: '客户端設置',
            category_en: 'Client Settings',
        },
        {
            id: 'disableFooter',
            label: '隱藏頁腳',
            label_en: 'Hide Footer',
            type: 'boolean',
            default: false,
            category: '客户端設置',
            category_en: 'Client Settings',
        },
        // 管理端設置
        {
            id: 'adminLoginBkImg',
            label: '登錄頁背景圖',
            label_en: 'Login Background',
            tooltip: '1.填寫 bing 使用必應壁紙輪播 <br/> 2.填寫 ["url1","url2"] 使用多張圖片輪播 <br/> 3.填寫 ["url"] 使用單張圖片',
            tooltip_en: '1. Enter "bing" for Bing wallpaper rotation <br/> 2. Enter ["url1","url2"] for multiple images <br/> 3. Enter ["url"] for a single image',
            category: '管理端設置',
            category_en: 'Admin Settings',
        },
        {
            id: 'adminBkImg',
            label: '管理頁背景圖',
            label_en: 'Admin Background',
            tooltip: '1.填寫 bing 使用必應壁紙輪播 <br/> 2.填寫 ["url1","url2"] 使用多張圖片輪播 <br/> 3.填寫 ["url"] 使用單張圖片',
            tooltip_en: '1. Enter "bing" for Bing wallpaper rotation <br/> 2. Enter ["url1","url2"] for multiple images <br/> 3. Enter ["url"] for a single image',
            category: '管理端設置',
            category_en: 'Admin Settings',
        },
    )

    const userConfig = env.USER_CONFIG
    if (userConfig) {
        try {
            const parsedConfig = JSON.parse(userConfig)
            if (typeof parsedConfig === 'object' && parsedConfig !== null) {
                // 搜索config中的id，如果存在則更新
                for (let i = 0; i < config.length; i++) {
                    const id = config[i].id
                    if (Object.prototype.hasOwnProperty.call(parsedConfig, id)) {
                        config[i].value = parsedConfig[id]
                    }
                }
            }
        } catch (error) {
            // do nothing
        }
    }

    // 用KV中的設置覆蓋默認設置
    for (let i = 0; i < settingsKV.config?.length; i++) {
        const item = settingsKV.config[i]
        const index = config.findIndex(x => x.id === item.id)
        if (index !== -1) {
            config[index].value = item.value
        }
    }

    return settings
}

/**
 * 處理公告內容及其刷新狀態。
 * 公告內容變化或管理員主動刷新時生成新版本；否則沿用舊版本，
 * 確保修改標題、背景等無關設置不會讓公告重複彈出。
 */
function processAnnouncementInfo(settings, previousSettings) {
    const previousAnnouncement = Array.isArray(previousSettings.config)
        ? previousSettings.config.find(item => item?.id === 'announcement')?.value ?? ''
        : ''
    const nextAnnouncement = Array.isArray(settings.config)
        ? settings.config.find(item => item?.id === 'announcement')?.value ?? ''
        : ''
    const shouldRefreshAnnouncement =
        previousAnnouncement !== nextAnnouncement || settings.refreshAnnouncement === true

    // 該字段只是前端發來的單次操作指令，不應進入持久化配置。
    delete settings.refreshAnnouncement

    if (shouldRefreshAnnouncement) {
        settings.announcementRefreshAt = Date.now()
    } else if (previousSettings.announcementRefreshAt) {
        settings.announcementRefreshAt = previousSettings.announcementRefreshAt
    } else {
        delete settings.announcementRefreshAt
    }

    return settings
}
