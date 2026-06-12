# Performance & Load Testing Guide

This directory contains performance tests and load testing utilities for Teleton Agent.

## Prerequisites

- Node.js 20+
- k6 (for load testing) or Apache Bench
- Redis (optional, for caching tests)
- PostgreSQL test database

## Quick Start

### Install Dependencies

```bash
cd tests/performance
npm install
```

### Run Load Test

```bash
# Basic load test with 100 users
npm run load-test

# Advanced test with custom parameters
npm run load-test -- --users 500 --duration 120s

# Stress test (find breaking point)
npm run stress-test
```

## Metrics Collected

| Metric | Description | Target |
|--------|-------------|--------|
| RPS | Requests per second | >400 |
| P95 Latency | 95th percentile response time | <500ms |
| P99 Latency | 99th percentile response time | <1000ms |
| Error Rate | Percentage of failed requests | <0.1% |

## Support

For performance issues:
- GitHub Issues: https://github.com/labtgbot/teleton-agent/issues
- Email: performance@teletonagent.dev
