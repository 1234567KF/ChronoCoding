#!/usr/bin/env node
/**
 * openai.cjs — OpenAI 供应商适配器
 *
 * OpenAI API 标准格式：
 * - GPT-4o-mini: 轻量快速，适合简单任务
 * - Codex: 代码生成专用
 */

const BaseAdapter = require('./base-adapter.cjs');

class OpenAIAdapter extends BaseAdapter {
  transformRequest(request) {
    return {
      model: this.getModelName(),
      messages: request.messages,
      temperature: request.temperature ?? 0.7,
      max_tokens: request.max_tokens ?? 4096,
      stream: request.stream ?? false,
    };
  }

  transformResponse(response) {
    if (!response) return null;

    return {
      content: response.choices?.[0]?.message?.content || '',
      role: response.choices?.[0]?.message?.role || 'assistant',
      usage: {
        input_tokens: response.usage?.prompt_tokens || 0,
        output_tokens: response.usage?.completion_tokens || 0,
        cache_hit_tokens: 0, // OpenAI 缓存统计不同
        cache_miss_tokens: 0,
      },
      model: response.model || this.model.id,
      finish_reason: response.choices?.[0]?.finish_reason || 'stop',
    };
  }

  async ping() {
    const start = Date.now();
    try {
      const url = `${this.getBaseUrl()}/models`;
      const response = await fetch(url, {
        method: 'GET',
        headers: this.getHeaders(),
      });
      const latency = Date.now() - start;
      return {
        alive: response.ok,
        latency,
        status: response.status,
      };
    } catch (err) {
      return {
        alive: false,
        latency: Date.now() - start,
        error: err.message,
      };
    }
  }
}

module.exports = OpenAIAdapter;
