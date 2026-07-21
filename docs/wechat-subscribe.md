# 微信订阅消息（生成完成推送）

小程序**不能**像 App 那样随便推系统通知。正式能力是 **订阅消息**：

1. 用户在点击「确认生成」时弹出授权  
2. 用户点「允许」后，服务端在任务完成/失败时调用微信接口推送一条消息  
3. 用户点击消息可打开结果页  

## 1. 公众平台配置模板

1. 登录 [微信公众平台](https://mp.weixin.qq.com/) → 你的小程序  
2. **功能 → 订阅消息**  
3. 选用公共模板，或选用/创建包含以下语义的字段（类型需匹配）：

| 用途 | 建议类型 | 示例文案 |
| --- | --- | --- |
| 作品风格 | 事物 `thing` | 复古胶片日记 |
| 生成状态 | 短语 `phrase` | 已完成 |
| 完成时间 | 时间 `time` | 2026年07月21日 21:30 |
| 温馨提示 | 事物 `thing` | 作品已就绪，点此查看 |

4. 添加后复制 **模板 ID**（形如 `xxxxxxxxxxxxxxxxxxxx`）

> 若模板字段序号不是 thing1/phrase2/time3/thing4，在 `.env` 里用 `WECHAT_SUBSCRIBE_FIELD_*` 改成实际字段名。

## 2. 服务器环境变量

在部署机 `.env` 中配置：

```env
WECHAT_MOCK_LOGIN=false
WECHAT_APP_ID=你的小程序AppID
WECHAT_APP_SECRET=你的AppSecret

# 订阅消息
WECHAT_SUBSCRIBE_TEMPLATE_ID=你的模板ID
WECHAT_SUBSCRIBE_FIELD_STYLE=thing1
WECHAT_SUBSCRIBE_FIELD_STATUS=phrase2
WECHAT_SUBSCRIBE_FIELD_TIME=time3
WECHAT_SUBSCRIBE_FIELD_TIP=thing4

# develop | trial | release（影响跳转打开的版本）
WECHAT_ENV_VERSION=release
```

重启服务后日志应出现：

```text
[notify] subscribe=enabled template=...
```

`GET /api/config` 会返回：

```json
{
  "subscribeEnabled": true,
  "subscribeTemplateId": "..."
}
```

## 3. 小程序侧流程（已实现）

1. 创作页加载 `/api/config` 拿到模板 ID  
2. 用户点「确认生成」时调用 `wx.requestSubscribeMessage`  
3. 若用户允许，创建任务时带 `notify: true`  
4. 任务成功/失败后服务端发送订阅消息，点击进入 `pages/job/index?id=...`

## 4. 测试注意

| 场景 | 说明 |
| --- | --- |
| 开发者工具 | 可调试授权弹窗，真机推送更可靠 |
| 用户点「取消」 | 不会推送，只能在「作品」里自己看 |
| 每次生成 | 订阅一次只能对应一次推送，需再次授权 |
| `WECHAT_MOCK_LOGIN=true` | 开发假 openid，**不会**真实推送 |
| 类目/模板未过审 | 发送会失败，看服务端 `[notify] subscribe send failed` |

## 5. 常见错误

- `43101 user refuse to accept the msg`：用户未授权或次数用尽  
- `40037 invalid template_id`：模板 ID 错误或非本小程序  
- `47003 argument invalid`：字段名/类型与模板不一致，检查 `WECHAT_SUBSCRIBE_FIELD_*`  
- 收不到：确认已发布正式版/体验版，且 `WECHAT_ENV_VERSION` 与打开版本一致  

## 6. 与「系统级推送」的区别

| 能力 | 是否支持 |
| --- | --- |
| 订阅消息（本方案） | ✅ 小程序标准做法 |
| 统一服务消息 / 客服消息 | 有额外限制，未默认接入 |
| 手机厂商推送（APNs/FCM） | ❌ 小程序不可用 |
