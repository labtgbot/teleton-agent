{
  "extends": "@playwright/test",
  "testDir": "./tests/e2e",
  "timeout": 30000,
  "retries": 2,
  "workers": 4,
  "reporter": [
    ["html", { outputFolder: "playwright-report" }],
    ["list"],
    ["json", { outputFile: "playwright-report/results.json" }]
  ],
  "use": {
    "headless": true,
    "viewport": { "width": 1920, "height": 1080 },
    "actionTimeout": 10000,
    "navigationTimeout": 30000,
    "screenshot": "only-on-failure",
    "video": "retain-on-failure",
    "trace": "retain-on-failure"
  },
  "projects": [
    {
      "name": "chromium",
      "use": { "browserName": "chromium" }
    },
    {
      "name": "firefox",
      "use": { "browserName": "firefox" }
    },
    {
      "name": "webkit",
      "use": { "browserName": "webkit" }
    },
    {
      "name": "Mobile Chrome",
      "use": { 
        "browserName": "chromium",
        "viewport": { "width": 412, "height": 915 },
        "deviceScaleFactor": 2.625,
        "isMobile": true,
        "hasTouch": true,
        "userAgent": "Mozilla/5.0 (Linux; Android 11; Pixel 5) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.120 Mobile Safari/537.36"
      }
    },
    {
      "name": "Mobile Safari",
      "use": { 
        "browserName": "webkit",
        "viewport": { "width": 390, "height": 844 },
        "deviceScaleFactor": 3,
        "isMobile": true,
        "hasTouch": true,
        "userAgent": "Mozilla/5.0 (iPhone; CPU iPhone OS 14_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/14.0 Mobile/15E148 Safari/604.1"
      }
    }
  ],
  "webServer": {
    "command": "pnpm start",
    "port": 3000,
    "timeout": 120000,
    "reuseExistingServer": !process.env.CI
  }
}
