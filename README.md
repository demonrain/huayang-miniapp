# 画漾微信小程序

小程序名称、简称、介绍与头像备选见 [品牌资料](docs/mini-program-branding.md)。

画漾是一个面向普通用户的 AI 风格图片小程序。用户通过微信快捷登录，选择模板并上传 1–6 张图片；服务端按张扣除积分、异步生成作品，并提供历史记录与相册保存。新用户默认赠送 20 积分，积分用完后可通过微信支付充值。

## 已实现

- 原生微信小程序：模板分类、批量选图、费用预估、任务进度、作品历史、批量保存、积分充值、账单和个人资料。
- 作品分享：保存单张/全部图片、微信图片分享、好友小程序卡片、朋友圈入口、公开作品页、小程序码和 URL Link。
- 运营后台：用户启停与积分调整、充值消费流水、作品状态与生成时间、首页 Banner、模板标签/人气/封面/积分、签到规则和充值套餐动态配置。
- 微信登录：开发环境固定测试用户；生产环境通过 `code2Session` 换取 `openid`。
- 积分账本：新用户赠送、任务扣费、失败退款、充值入账均保留明细；任务请求和支付通知均做幂等处理。
- 图片服务：开发模式回传上传图片以走通链路；生产模式支持 OpenAI Images Edits 兼容接口。
- 微信支付 v3：JSAPI 下单、小程序调起支付、平台公钥验签、AES-GCM 回调解密和幂等入账。
- 单机持久化：数据原子写入 JSON，图片保存在本地卷；服务重启会恢复未完成任务。

## 本地运行

要求 Node.js 22 或更高版本。首次运行先安装项目依赖。

```powershell
cd H:\git\huayang-miniapp
Copy-Item .env.example .env
npm install
npm test
npm run dev
```

服务默认运行在 `http://127.0.0.1:8787`，健康检查为 `GET /health`。

管理后台地址为 `http://127.0.0.1:8787/admin`。本地默认密码为 `admin123456`；部署前必须通过 `ADMIN_PASSWORD` 修改，生产环境检测到默认密码会拒绝启动。

在微信开发者工具中导入项目根目录。当前 `project.config.json` 使用 `touristappid`，可直接体验界面；需要登录、相册和支付等完整能力时，将其中的 `appid` 换成你的小程序 AppID。开发者工具本地调试需关闭“校验合法域名”，手机预览则必须使用 HTTPS 服务域名。

## 生产配置

1. 复制 `.env.example` 为 `.env`，生成至少 32 字节随机 `TOKEN_SECRET`。
2. 设置 `WECHAT_MOCK_LOGIN=false`、`WECHAT_APP_ID` 和 `WECHAT_APP_SECRET`。
   同时设置 `WECHAT_ENV_VERSION=release`；体验版联调可改为 `trial`。小程序码和 URL Link 只有在真实微信配置下生成。
3. 设置 `IMAGE_PROVIDER=compatible`，填写 `IMAGE_API_BASE`、`IMAGE_API_KEY`、模型和尺寸。提供商需要兼容 multipart Images Edits 请求及 `data[].b64_json` 或 `data[].url` 响应。
4. 设置 `PAYMENT_MODE=wechat`，填写商户号、商户证书序列号、商户私钥、API v3 密钥、微信支付平台公钥和公网 HTTPS 回调地址。
5. 将 [config.js](./miniprogram/config.js) 的地址改为正式 HTTPS API 域名，并在微信公众平台配置 `request`、`uploadFile`、`downloadFile` 合法域名。
6. 在微信公众平台声明相册、相机、头像昵称等隐私用途，发布正式《隐私保护指引》和用户协议。

单机部署可执行：

```powershell
docker compose up -d --build
```

`server/data` 与 `server/media` 必须挂载持久卷。公网前面应使用 Nginx、Caddy 或云负载均衡终止 HTTPS，`PUBLIC_BASE_URL` 必须与小程序合法域名一致。

## 目录

```text
miniprogram/        微信小程序源码
admin/              模板、积分和充值运营后台
server/src/         登录、积分、生图、支付与 HTTP 服务
server/test/        完整业务链路集成测试
scripts/            项目结构与语法校验
docs/               产品规则、接口和上线清单
```

## 上线边界

当前数据层适合单实例 MVP。开始投放或启用多实例前，应将 `JsonStore` 替换为 MySQL/PostgreSQL，并使用数据库事务与唯一索引承接积分账本、任务幂等键、签到和支付订单；模板封面与作品应迁移到对象存储并配置生命周期。服务接口和小程序调用层无需因此改变。

模板卡当前使用本地稳定的配色预览，因为本次会话未提供可调用的图片生成工具。`catalog.mjs` 已集中保留模板提示词；接入生图服务后可批量生成真实封面并在模板数据中增加 `coverUrl`。
