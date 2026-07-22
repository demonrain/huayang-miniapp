# HTTP API

除登录、模板、Banner、配置、公开分享、支付通知和媒体文件外，接口都需要 `Authorization: Bearer <token>`。

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| `GET` | `/health` | 健康检查 |
| `GET` | `/api/config` | 客户端公开配置（含订阅消息模板 ID） |
| `POST` | `/api/auth/wechat` | 使用微信登录 code 换取令牌 |
| `GET/PATCH` | `/api/me` | 获取或修改昵称头像 |
| `GET` | `/api/profile` | 用户和作品统计 |
| `GET` | `/api/templates` | 模板列表 |
| `GET` | `/api/banners` | 已启用的首页 Banner 列表 |
| `POST` | `/api/assets` | multipart 上传图片，字段名 `image` |
| `POST` | `/api/jobs` | 创建生成任务 |
| `GET` | `/api/jobs` | 当前用户任务列表 |
| `GET` | `/api/jobs/:id` | 任务状态与结果 |
| `DELETE` | `/api/jobs/:id` | 删除失败任务记录（仅 `failed`） |
| `GET/POST` | `/api/admin/categories` | 模板分类列表 / 新建 |
| `PATCH/DELETE` | `/api/admin/categories/:id` | 更新 / 删除模板分类 |
| `GET` | `/api/wallet` | 余额、套餐和积分明细（`limit`/`offset` 分页流水，默认 limit=50） |
| `POST` | `/api/checkins` | 每日签到并领取后台配置的积分 |
| `POST` | `/api/payments/orders` | 创建充值订单 |
| `POST` | `/api/payments/notify` | 微信支付 v3 通知 |
| `POST` | `/api/jobs/:id/share` | 创建公开作品分享令牌 |
| `POST` | `/api/jobs/:id/share/qrcode` | 生成微信小程序码 |
| `POST` | `/api/jobs/:id/share/url-link` | 生成微信 URL Link |
| `GET` | `/api/shares/:token` | 匿名读取公开分享作品 |
| `POST` | `/api/cdks/redeem` | 使用 CDK 兑换积分（需登录） |
| `GET/POST` | `/api/admin/cdks` | CDK 列表 / 批量生成 |
| `DELETE` | `/api/admin/cdks/:id` | 删除未使用的 CDK |
| `POST` | `/api/share-rewards` | 上报分享并发放分享积分（需登录） |
| `GET` | `/api/share-rewards/me` | 当前用户分享/邀请统计 |
| `GET` | `/api/admin/share-stats` | 分享与邀请汇总 |
| `GET` | `/api/admin/share-events` | 分享明细与邀请关系 |

管理接口使用独立管理员令牌：

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| `POST` | `/api/admin/login` | 管理员密码登录 |
| `GET` | `/api/admin/overview` | 统计、设置、Banner、套餐与模板数量（不含全量模板） |
| `PATCH` | `/api/admin/settings` | 修改签到、新用户积分和分享标题 |
| `GET/PATCH` | `/api/admin/users[/:id]` | 查询用户或修改启用状态 |
| `POST` | `/api/admin/users/:id/credits` | 调整用户积分并写入流水 |
| `GET` | `/api/admin/transactions` | 查询充值、消费及其他积分流水 |
| `GET` | `/api/admin/jobs` | 查询作品任务、状态和生成时间 |
| `POST/PATCH` | `/api/admin/banners[/:id]` | 新增或修改首页 Banner |
| `POST` | `/api/admin/banners/:id/image` | 上传 Banner 图片 |
| `GET` | `/api/admin/templates` | 模板分页列表（`page`/`pageSize`/`query`/`status`/`category`） |
| `POST/PATCH` | `/api/admin/templates[/:id]` | 新增或修改模板 |
| `POST` | `/api/admin/templates/:id/cover` | 上传模板封面 |
| `POST/PATCH` | `/api/admin/packages[/:id]` | 新增或修改充值套餐 |

创建任务请求示例：

```json
{
  "templateId": "film-diary",
  "assetIds": ["asset-uuid"],
  "clientRequestId": "device-generated-unique-id",
  "notify": true
}
```

`notify: true` 表示用户已授权订阅消息，任务完成/失败后服务端尝试推送。配置见 [wechat-subscribe.md](./wechat-subscribe.md)。

错误响应统一为：

```json
{
  "code": "INSUFFICIENT_CREDITS",
  "message": "积分不足，请先充值"
}
```
