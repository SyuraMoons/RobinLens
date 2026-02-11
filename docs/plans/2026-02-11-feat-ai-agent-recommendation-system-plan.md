---
title: "feat: AI Agent Configurable Recommendation System"
type: feat
date: 2026-02-11
---

# AI Agent Configurable Recommendation System

## Overview

新增 `/recommendations` 页面，用户通过 toggle 开关选择数据源（On-Chain / Technical），点击"Analyze"后系统预筛 Top 20 token，一次性发送给 GPT-4o，返回 Top 10 推荐，每条推荐包含评分、理由、使用的数据源和风险等级。

## Problem Statement

当前 RobinLens 只支持单 token 分析（用户点进 `/token/:id` 后手动触发 AI 分析）。用户无法一次性了解"现在最值得关注的是哪些 token"，需要逐个点击查看。缺少批量筛选和比较推荐的能力。

## Proposed Solution

### 数据源架构

```
用户 Toggle 开关
  ├── On-Chain (Goldsky subgraph) ← 已有
  │     持有者分布, 交易量, 曲线进度, 创建者活动
  └── Technical (从现有价格/交易数据计算) ← 新增计算
        价格动量, 交易速度, 买卖比, 趋势方向

         ↓ 启用的数据源

  客户端预筛 Top 20 (按 on-chain 指标评分排序)
         ↓

  AI Agent Orchestrator
  (动态组装 prompt, 只包含启用的数据源)
         ↓

  GPT-4o (单次调用, response_format: json_object)
         ↓ Zod 校验

  Top 10 推荐列表
  - RobinScore (0-100)
  - 推荐理由
  - 使用了哪些数据源
  - 建议操作 + 风险等级
```

### MVP 范围

**包含:**
- On-Chain 数据源（复用现有 Goldsky 查询 + metrics 计算）
- Technical 数据源（从现有交易数据计算动量/趋势）
- 新 `/recommendations` 页面 + 路由 + 导航入口
- 数据源 toggle 开关面板
- AI Orchestrator（动态 prompt + Zod 校验）
- 结果缓存（localStorage, 15 分钟过期）
- 60 秒冷却防止滥用

**不包含 (后续迭代):**
- News 数据源（需要 Vercel serverless 代理解决 CORS + CryptoPanic 对小币覆盖不足）
- Social 数据源（需要 Twitter/Farcaster API）
- 用户自定义权重/偏好

## Technical Approach

### 新增文件

#### `frontend/src/lib/recommendationSchema.ts`

Zod v4 schema 定义 AI 推荐输出格式：

```typescript
// 单条推荐
const TokenRecommendationSchema = z.object({
  curveId: z.string(),
  name: z.string(),
  symbol: z.string(),
  robinScore: z.number().min(0).max(100),
  explanation: z.string(),
  contributingSources: z.array(z.enum(['on_chain', 'technical'])),
  suggestedAction: z.enum(['strong_buy', 'buy', 'hold', 'avoid']),
  riskLevel: z.enum(['low', 'medium', 'high', 'critical']),
  reasoning: z.object({
    onChain: z.string().optional(),
    technical: z.string().optional(),
  }),
})

// 完整推荐响应
const RecommendationResponseSchema = z.object({
  recommendations: z.array(TokenRecommendationSchema).max(10),
  marketSummary: z.string(),
  analysisTimestamp: z.string(),
})
```

#### `frontend/src/lib/recommender.ts`

AI Orchestrator 核心逻辑，遵循 `analyzer.ts` 的三阶段模式：

1. **数据收集**: 根据启用的数据源，调用 Goldsky 获取 token 列表 + 交易数据，计算 metrics
2. **客户端预筛**: 按 composite score（交易量 + 持有者数 + 动量）排序，取 Top 20
3. **Prompt 组装**: 根据启用的数据源动态构建 system prompt 和 user prompt
4. **LLM 调用**: 单次 GPT-4o 调用，`temperature: 0.3`, `response_format: json_object`
5. **Zod 校验**: `RecommendationResponseSchema.parse()` 校验 AI 输出

关键函数签名：
```typescript
type DataSource = 'on_chain' | 'technical'

interface RecommendationConfig {
  enabledSources: DataSource[]
}

export async function getRecommendations(
  config: RecommendationConfig
): Promise<RecommendationResponse>
```

Prompt 动态适配逻辑：
- 只启用 On-Chain → prompt 侧重持有者分布、交易活跃度、曲线进度分析
- 只启用 Technical → prompt 侧重价格动量、趋势方向、买卖比
- 两者都启用 → prompt 综合分析，AI 在 reasoning 中分别说明每个维度的贡献

#### `frontend/src/lib/technicalMetrics.ts`

从现有交易数据计算技术指标：

```typescript
interface TechnicalMetrics {
  priceChange1h: number      // 最近 1 小时价格变化百分比
  priceChange24h: number     // 最近 24 小时价格变化百分比
  tradeVelocity: number      // 最近 1h 交易数 / 平均每小时交易数
  buySellRatio: number       // 复用 metrics.ts 中已有计算
  volumeMomentum: number     // 复用 metrics.ts 中已有计算
  trendDirection: 'up' | 'down' | 'flat'  // 基于最近 N 笔交易的价格趋势
}
```

注意：不做传统 support/resistance 分析。大多数 RobinPump token 历史数据太短（几小时到几天），不够做有意义的技术分析。MVP 只做简单的动量和趋势指标。

#### `frontend/src/hooks/useRecommendations.ts`

遵循 Leaderboard 的一次性加载模式（非轮询），因为推荐是用户主动触发的：

```typescript
interface UseRecommendationsReturn {
  recommendations: RecommendationResponse | null
  loading: boolean
  error: string | null
  analyze: (config: RecommendationConfig) => Promise<void>
  cachedAt: number | null  // 缓存时间戳
}
```

- 页面加载时检查 localStorage 缓存（key: `robinlens:recommendations`）
- 缓存 15 分钟内有效，显示 "X 分钟前的分析结果" 提示
- `analyze()` 函数触发完整流程，60 秒冷却期

#### `frontend/src/pages/Recommendations.tsx`

页面结构：

```
┌─────────────────────────────────────────────┐
│ Navbar (+ "Recommendations" 导航项)          │
├─────────────────────────────────────────────┤
│ 数据源配置面板                                │
│ ┌──────────┐ ┌──────────┐                   │
│ │ On-Chain  │ │Technical │                   │
│ │  [ON]     │ │  [ON]    │                   │
│ └──────────┘ └──────────┘                   │
│                                              │
│ [Analyze] 按钮                               │
│ (至少启用一个数据源才可点击, 60s 冷却)         │
├─────────────────────────────────────────────┤
│ 加载状态 (多步骤进度)                         │
│ "Fetching on-chain data..."                  │
│ "Computing technical metrics..."             │
│ "Running AI analysis..."                     │
├─────────────────────────────────────────────┤
│ 市场概要 (marketSummary)                     │
├─────────────────────────────────────────────┤
│ Top 10 推荐卡片网格                           │
│ ┌──────────────┐ ┌──────────────┐           │
│ │ #1 TokenName │ │ #2 TokenName │           │
│ │ Score: 78    │ │ Score: 72    │           │
│ │ [On-Chain]   │ │ [On-Chain]   │           │
│ │ [Technical]  │ │ [Technical]  │           │
│ │ 理由摘要...  │ │ 理由摘要...  │            │
│ │ 建议: Buy    │ │ 建议: Hold   │           │
│ │ 风险: Medium │ │ 风险: High   │           │
│ └──────────────┘ └──────────────┘           │
│ ...                                          │
├─────────────────────────────────────────────┤
│ ⚠ Not financial advice                      │
└─────────────────────────────────────────────┘
```

#### `frontend/src/components/RecommendationCard.tsx`

单条推荐的展示卡片：
- 排名序号 + token 名称/symbol
- RobinScore badge（复用 `ScoreBadge` 组件）
- 数据源标签（显示哪些数据源贡献了此推荐）
- 推荐理由文本
- suggestedAction badge (strong_buy/buy/hold/avoid)
- riskLevel 指示器
- 点击跳转到 `/token/:id`

#### `frontend/src/components/SourceToggle.tsx`

数据源开关组件：
- Toggle switch 开/关状态
- 数据源名称 + 简短描述
- 禁用状态样式（当数据源不可用时）

### 修改文件

| 文件 | 改动 |
|------|------|
| `App.tsx` | 添加 `<Route path="/recommendations" element={<Recommendations />} />` |
| `components/Navbar.tsx` | NAV_ITEMS 数组添加 `{ path: '/recommendations', label: 'Recommendations' }` |
| `.env.example` | 暂无新增（MVP 不用 CryptoPanic） |

### 预筛评分公式

客户端预筛 Top 20 的 composite score（无需 AI，纯数值排序）：

```
preFilterScore =
  normalize(tradeCount) * 0.3 +
  normalize(holderCount) * 0.25 +
  normalize(volumeMomentum) * 0.25 +
  normalize(1 - top10Concentration) * 0.2
```

其中 `normalize()` 是 min-max 归一化到 [0, 1]。排除已 graduated 的 token（已离开曲线）。

## Acceptance Criteria

### Functional

- [ ] `/recommendations` 页面可访问，导航栏有入口
- [ ] 页面有 On-Chain 和 Technical 两个 toggle 开关，默认都开启
- [ ] 全部关闭时 Analyze 按钮禁用，提示至少启用一个
- [ ] 点击 Analyze 后显示多步骤加载进度
- [ ] 返回 Top 10 推荐列表，每条包含 score、理由、数据源标签、操作建议、风险等级
- [ ] 推荐卡片点击可跳转到 `/token/:id`
- [ ] 只启用 On-Chain 时，prompt 和结果只涉及链上数据
- [ ] 只启用 Technical 时，prompt 和结果只涉及技术指标
- [ ] 结果缓存 15 分钟，页面刷新/返回时恢复
- [ ] 60 秒冷却期防止连续调用
- [ ] 无 OpenAI API key 时显示 demo/fallback 数据
- [ ] 页面底部有 "Not financial advice" 声明

### Non-Functional

- [ ] 单次分析总耗时 < 30 秒
- [ ] AI 输出通过 Zod schema 校验
- [ ] OpenAI 单次调用成本 < $0.50
- [ ] 移动端 responsive 布局正常
- [ ] 所有错误状态有用户友好的提示

## Dependencies & Risks

| 风险 | 影响 | 缓解 |
|------|------|------|
| GPT-4o 返回不合法 JSON | 分析失败 | Zod 校验 + 用户友好错误提示 + 重试按钮 |
| OpenAI 调用超时 | 用户等太久 | 设置 30s timeout，超时提示重试 |
| 预筛 Top 20 质量不够 | 好 token 被漏掉 | 评分公式可调整，后续可加权重参数 |
| 评分与单 token 分析不一致 | 用户困惑 | 在 UI 说明推荐评分是 comparative ranking，与单 token 分析侧重不同 |
| API key 暴露在客户端 | 已知架构债务 | 这是现有问题，不因本 feature 变化 |

## Future Considerations

- **News 数据源**: 添加 Vercel serverless function 代理 CryptoPanic API，解决 CORS
- **Social 数据源**: 接入 Twitter/Farcaster API
- **用户自定义权重**: 让用户调整各数据源对评分的影响权重
- **自动刷新**: 可选的定期自动重新分析（每 5 分钟）
- **推送通知**: 当高分 token 出现时通知用户

## References

### Internal

- AI 分析流程: `frontend/src/lib/analyzer.ts` (prompt 构建, OpenAI 调用, Zod 校验)
- Zod schema 模式: `frontend/src/lib/analysisSchema.ts` (子 schema 组合, enum, 范围约束)
- 指标计算: `frontend/src/lib/metrics.ts` (on-chain metrics 计算, `OnChainMetrics` 接口)
- Goldsky 客户端: `frontend/src/lib/goldsky.ts` (GraphQL 查询, 重试逻辑, 类型定义)
- 页面模式: `frontend/src/pages/Leaderboard.tsx` (一次性加载, 数据处理)
- 路由: `frontend/src/App.tsx` (React Router v7 路由定义)
- 导航: `frontend/src/components/Navbar.tsx` (NAV_ITEMS 数组)

### External

- [CryptoPanic API](https://cryptopanic.com/developers/api/) (后续 News 数据源)
- [OpenAI JSON Mode](https://platform.openai.com/docs/guides/structured-outputs) (response_format: json_object)
