### Description

> Describe the purpose of this PR along with any background information and the impacts of the proposed change. For the benefit of the community, please do not assume prior context.
>
> Provide details that support your chosen implementation, including: breaking changes, alternatives considered, changes to the API, contracts etc.
>
> If the UI is being changed, please provide screenshots.

**🚀 FIFO Queue Implementation for Rate Limiting Prevention**

This PR introduces a centralized First-In-First-Out (FIFO) request queue system to prevent API rate limiting issues when fetching data from external sources like Binance and Quidax.

**Problem Solved:**
- Multiple concurrent API requests were triggering rate limiters on external APIs (HTTP 429 errors)
- 79+ currency sources making simultaneous requests every 5-10 minutes caused service disruptions
- Application crashes due to unhandled rate limiting responses

**Solution:**
- **Centralized RequestQueue**: Singleton pattern ensuring all API requests go through a single queue
- **2-second delay**: Minimum delay between requests to respect API rate limits
- **FIFO processing**: Requests are processed in the order they were received
- **Error handling**: Graceful handling of queue processing errors without crashing the application

**Technical Implementation:**
```typescript
// Located in: src/rates/sources/source.ts
class RequestQueue {
  private static instance: RequestQueue;
  private queue: Array<() => Promise<any>> = [];
  private processing = false;
  private lastRequestTime = 0;
  private minDelayBetweenRequests = 2000; // 2 seconds
}
```

**Files Modified:**
- `src/rates/sources/source.ts` - Added RequestQueue class and queuedRequest method
- `src/rates/sources/binance.source.ts` - Refactored to use queued requests
- `src/rates/sources/quidax.source.ts` - Refactored to use queued requests

**Impact:**
- ✅ Eliminates rate limiting errors (HTTP 429)
- ✅ Ensures reliable data fetching from external APIs
- ✅ Maintains application stability under high load
- ✅ Backward compatible - no breaking changes to existing API

### References

> Include any links supporting this change such as a:
>
> - GitHub Issue/PR number addressed or fixed e.g closes #407
> - StackOverflow post
> - Support forum thread
> - Related pull requests/issues from other repos
>
> If there are no references, simply delete this section.


### Testing

> Describe how this can be tested by reviewers. Be specific about anything not tested and reasons why. If this project has unit and/or integration testing, tests should be added for new functionality and existing tests should complete without errors.
>
> Please include any manual steps for testing end-to-end or functionality not covered by unit/integration tests.
>
> Also include details of the environment this PR was developed in (language/platform/browser version).

**FIFO Queue Testing:**

**Manual Testing Steps:**
1. **Start the application**: `npm run start:dev`
2. **Monitor logs**: Watch for rate limiting errors (should be eliminated)
3. **Test multiple currency endpoints simultaneously**:
   ```bash
   curl http://localhost:8000/rates/usdt/ngn &
   curl http://localhost:8000/rates/usdt/usd &
   curl http://localhost:8000/rates/usdc/eur &
   ```
4. **Verify queue behavior**: Check that requests are processed with 2-second delays
5. **Load testing**: Make rapid API calls to ensure queue handles burst traffic

**Expected Results:**
- No HTTP 429 (rate limiting) errors in logs
- All requests processed successfully with appropriate delays
- Application remains stable under concurrent load
- Data fetching continues reliably for all 79+ supported currencies

**Environment:**
- Node.js v22.17.0
- NestJS v10.x
- TypeScript 5.x
- macOS/Linux development environment

- [ ] This change adds test coverage for new/changed/fixed functionality


### Checklist

- [ ] I have added documentation for new/changed functionality in this PR
- [ ] All active GitHub checks for tests, formatting, and security are passing
- [ ] The correct base branch is being used, if not `main`
- [ ] FIFO queue implementation has been tested with multiple concurrent requests
- [ ] Rate limiting prevention has been verified through manual testing
- [ ] No breaking changes introduced to existing API endpoints


By submitting a PR to this repository, you agree to the terms within the [Paycrest Code of Conduct](https://www.notion.so/paycrest/Contributor-Code-of-Conduct-1602482d45a2806bab75fd314b381f4c?pvs=4). Please see the [contributing guidelines](https://paycrest.notion.site/Contribution-Guide-1602482d45a2809a8930e6ad565c906a?pvs=4) for how to create and submit a high-quality PR for this repo.
