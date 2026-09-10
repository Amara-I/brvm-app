import { z } from "zod";

const fibDrawingSchema = z.union([
  z.object({
    id: z.string().min(1),
    type: z.literal("fib"),
    t1: z.string().min(1),
    p1: z.number().finite(),
    t2: z.string().min(1),
    p2: z.number().finite(),
  }),
  z.object({
    id: z.string().min(1),
    type: z.literal("fib"),
    high: z.number().finite(),
    low: z.number().finite(),
  }),
]);

const drawingSchema = z.union([
  z.object({
    id: z.string().min(1),
    type: z.literal("horiz"),
    price: z.number().finite(),
  }),
  fibDrawingSchema,
  z.object({
    id: z.string().min(1),
    type: z.literal("trend"),
    t1: z.string().min(1),
    p1: z.number().finite(),
    t2: z.string().min(1),
    p2: z.number().finite(),
  }),
  z.object({
    id: z.string().min(1),
    type: z.literal("measure"),
    t1: z.string().min(1),
    p1: z.number().finite(),
    t2: z.string().min(1),
    p2: z.number().finite(),
  }),
]);

const indicatorsSchema = z.object({
  sma10: z.boolean(),
  sma20: z.boolean(),
  sma50: z.boolean(),
  sma200: z.boolean(),
  ema12: z.boolean(),
  ema26: z.boolean(),
  bollinger: z.boolean(),
  rsi: z.boolean(),
  macd: z.boolean(),
  obv: z.boolean(),
  volumeFlow: z.boolean(),
  adx: z.boolean().optional().default(false),
  stochastic: z.boolean().optional().default(false),
  williamsR: z.boolean().optional().default(false),
  cci: z.boolean().optional().default(false),
});

export const chartAnalysisBodySchema = z.object({
  id: z.string().trim().min(1).optional(),
  ticker: z
    .string()
    .trim()
    .min(1)
    .max(12)
    .transform((t) => t.toUpperCase()),
  name: z.string().trim().min(1).max(80),
  drawings: z.array(drawingSchema).max(80),
  indicators: indicatorsSchema,
  range: z.string().trim().min(1).max(8),
  interval: z.enum(["1H", "1D", "1W", "1M"]),
  compareTickers: z
    .array(z.string().trim().min(1).max(12))
    .max(5)
    .transform((arr) => arr.map((t) => t.toUpperCase())),
});

export type ChartAnalysisBody = z.infer<typeof chartAnalysisBodySchema>;
