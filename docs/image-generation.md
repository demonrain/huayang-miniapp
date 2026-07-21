# 生图失败排查

小程序创建任务后，服务端异步调用生图 API。失败会退积分，并在结果页显示 `job.error`。

## 当前逻辑

| `IMAGE_PROVIDER` | 行为 |
| --- | --- |
| `mock` | 不调外部 API，约 800ms 后复制原图（演示用） |
| `compatible` | `POST IMAGE_API_BASE`，multipart：`model` / `prompt` / `size` / `image` |

线上若 `GET /api/config` 里 `imageProvider` 为 `compatible`，失败原因几乎总是 **上游 API 调用失败**。

## 推荐环境变量

```env
IMAGE_PROVIDER=compatible
IMAGE_API_BASE=https://store.demonrain.top/v1/images/edits
IMAGE_API_KEY=你的密钥
IMAGE_MODEL=gpt-image-1
IMAGE_SIZE=1024x1024
IMAGE_TIMEOUT_MS=300000
IMAGE_FORM_IMAGE_FIELD=image
# 多数 gpt-image 网关不要带 response_format，保持为空
IMAGE_RESPONSE_FORMAT=
```

管理后台每个模板必须填写 **生图提示词**（`prompt`），否则会报「模板未配置生图提示词」。

## 服务器上怎么确认

```bash
# 1. 看当前配置（不会打印完整密钥）
docker compose logs --tail=100 api | grep -E '\[image\]|\[job:|\[image:'

# 启动时应有：
# [image] provider=compatible endpoint=... model=... key=set

# 2. 失败任务日志示例
# [image:compatible] job=... HTTP 401 ...
# [job:...] failed: Error: Incorrect API key ...
```

## 常见错误与改法

| 现象 / 日志 | 处理 |
| --- | --- |
| `IMAGE_API_KEY 未配置` | `.env` 填写 `IMAGE_API_KEY` 并重启 |
| `401` / `Unauthorized` / `Incorrect API key` | 密钥错误或未生效 |
| `model_not_found` / 模型不存在 | 改 `IMAGE_MODEL` 为网关支持的模型名 |
| `Invalid size` | 改 `IMAGE_SIZE`，或设 `IMAGE_SIZE=` 空字符串省略 size |
| `response_format` 相关错误 | 保持 `IMAGE_RESPONSE_FORMAT=` 为空 |
| 超时 `AbortError` / `生图超时` | 增大 `IMAGE_TIMEOUT_MS`，或压缩上传图 |
| `无法连接生图服务` | 服务器出网、DNS、HTTPS 证书、网关地址 |
| `响应格式不支持` | 网关返回结构不是 `data[0].b64_json/url`，需对照文档改适配 |
| `模板未配置生图提示词` | 管理后台编辑模板，填写 prompt |

## 手工探测网关

在**服务器**上（能访问公网）执行：

```bash
# 应返回 401 而不是连不上（说明域名通）
curl -sS -o /dev /null -w "%{http_code}\n" https://store.demonrain.top/v1/images/edits

# 带密钥测（把 key 换成真实值；需要一张本地图）
curl -sS https://store.demonrain.top/v1/images/edits \
  -H "Authorization: Bearer $IMAGE_API_KEY" \
  -F "model=gpt-image-1" \
  -F "prompt=make it watercolor style, keep identity" \
  -F "size=1024x1024" \
  -F "image=@./test.jpg"
```

成功时响应大致为：

```json
{ "data": [ { "b64_json": "..." } ] }
```

或：

```json
{ "data": [ { "url": "https://..." } ] }
```

## 结果页文案

部署包含错误详情的版本后，失败会显示：

```text
生图失败：具体原因（积分已退回）
```

若仍只看到「生图服务暂时不可用」，说明线上还是旧代码，需要重新部署当前 `server`。
