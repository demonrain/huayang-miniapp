# HTTP API

除登录、模板、Banner、配置、公开分享、支付通知和媒体文件外，接口都需要 `Authorization: Bearer <token>`。

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| `GET` | `/health` | 健康检查 |
| `GET` | `/api/config` | 客户端公开配置（含订阅消息模板 ID） |
| `POST` | `/api/auth/wechat` | 使用微信登录 code 换取令牌 |
| `GET/PATCH` | `/api/me` | 获取或修改昵称头像 |
| `GET` | `/api/profile` | 用户和作品统计 |
| `GET` | `/api/templates` | 模板列表（可选 `page`/`pageSize`/`category`/`id`；不传 page 时返回全量） |
| `GET` | `/api/banners` | 已启用的首页 Banner 列表 |
| `POST` | `/api/assets` | multipart 上传图片，字段名 `image` |
| `POST` | `/api/jobs` | 创建生成任务 |
| `GET` | `/api/jobs` | 当前用户任务列表（可选 `page`/`pageSize`；不传则全量） |
| `GET` | `/api/jobs/:id` | 任务状态与结果 |
| `GET` | `/api/showcase/jobs/:id` | 公开作品展示（需作者开启公开共享；原图取决于作者设置） |
| `POST` | `/api/jobs/:id/public-share` | 作者公开/取消公开作品（`enabled`、`showOriginals`；首次公开可获积分） |
| `GET` | `/api/gallery` | 花海列表（公开作品，`page`/`pageSize`/`authorId`/`exclude`） |
| `POST` | `/api/gallery/:jobId/like` | 点赞花海作品（点赞者/作者分别加分，每人每作品一次） |
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
| `GET` | `/api/feedbacks` | 当前用户反馈历史（含官方回复） |
| `POST` | `/api/feedbacks` | 提交建议反馈（需登录；`type`: problem/feature/template_request） |
| `GET/POST` | `/api/admin/cdks` | CDK 列表（`page`/`pageSize`/`status` 含 unused/active/exhausted/expired/revoked）/ 批量生成 |
| `PATCH` | `/api/admin/cdks/:id` | 修改积分/可兑换次数/备注，或 `revoked:true` 撤销 |
| `POST` | `/api/admin/cdks/:id/revoke` | 撤销兑换码（不可再兑，保留历史） |
| `DELETE` | `/api/admin/cdks/:id` | 删除无兑换记录的 CDK |
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
| `GET/PATCH` | `/api/admin/users[/:id]` | 查询用户或修改启用状态（列表支持 `page`/`pageSize`） |
| `POST` | `/api/admin/users/:id/credits` | 调整用户积分并写入流水 |
| `GET` | `/api/admin/transactions` | 查询充值、消费及其他积分流水（`page`/`pageSize`） |
| `GET` | `/api/admin/jobs` | 查询作品任务（`page`/`pageSize`/`status`/`share`：all\|public\|private\|public_with_originals） |
| `POST` | `/api/admin/jobs/:id/public-share` | 管理员公开/取消公开作品（供 Banner 跳转） |
| `POST` | `/api/admin/jobs/:id/banner` | 一键用该作品创建 Banner（封面=生成图、公开任务、跳转作品展示） |
| `POST/PATCH` | `/api/admin/banners` | 支持 `coverJobId`：用作品生成图作为 Banner 封面 |
| `DELETE` | `/api/admin/banners/:id` | 删除 Banner |
| `POST` | `/api/admin/jobs/:id/samples` | 将任务某张结果加入模板「更多效果参考」 |
| `DELETE` | `/api/admin/jobs/:id/samples` | 从模板「更多效果参考」中移除该结果（body: `resultId`） |
| `GET` | `/api/admin/feedbacks` | 用户建议反馈列表（`type`/`status`/`page`/`pageSize`） |
| `POST` | `/api/admin/feedbacks/:id/reply` | 回复用户反馈（body: `reply`） |
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
