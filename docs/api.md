# HTTP API

除登录、模板、配置、支付通知和媒体文件外，接口都需要 `Authorization: Bearer <token>`。

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| `GET` | `/health` | 健康检查 |
| `GET` | `/api/config` | 客户端公开配置 |
| `POST` | `/api/auth/wechat` | 使用微信登录 code 换取令牌 |
| `GET/PATCH` | `/api/me` | 获取或修改昵称头像 |
| `GET` | `/api/profile` | 用户和作品统计 |
| `GET` | `/api/templates` | 模板列表 |
| `POST` | `/api/assets` | multipart 上传图片，字段名 `image` |
| `POST` | `/api/jobs` | 创建生成任务 |
| `GET` | `/api/jobs` | 当前用户任务列表 |
| `GET` | `/api/jobs/:id` | 任务状态与结果 |
| `GET` | `/api/wallet` | 余额、套餐和积分明细 |
| `POST` | `/api/payments/orders` | 创建充值订单 |
| `POST` | `/api/payments/notify` | 微信支付 v3 通知 |

创建任务请求示例：

```json
{
  "templateId": "film-diary",
  "assetIds": ["asset-uuid"],
  "clientRequestId": "device-generated-unique-id"
}
```

错误响应统一为：

```json
{
  "code": "INSUFFICIENT_CREDITS",
  "message": "积分不足，请先充值"
}
```

