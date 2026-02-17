// Console Log Shim for Poof
// This script intercepts console methods and sends them to the parent iframe
(function () {
  // Only run if not in LIVE/production environment
  // Check if VITE_ENV is set to LIVE via window object (Vite injects env vars into window)
  if (typeof window !== 'undefined' && window.__VITE_ENV__ === 'LIVE') {
    return; // Silent exit on LIVE - no logs, no interference
  }

  // Store original console methods
  const originalConsole = {
    log: console.log,
    error: console.error,
    warn: console.warn,
    info: console.info,
    debug: console.debug,
  };

  // Track shim health
  let messagesSent = 0;
  let messagesFailed = 0;
  let lastError = null;

  // Helper function to serialize console arguments
  function serializeArgs(args) {
    return Array.from(args).map((arg) => {
      try {
        if (arg === null) return 'null';
        if (arg === undefined) return 'undefined';
        if (typeof arg === 'function') return arg.toString();
        if (typeof arg === 'object') {
          // Handle Error objects specially
          if (arg instanceof Error) {
            return {
              message: arg.message,
              stack: arg.stack,
              name: arg.name,
            };
          }
          // Try to stringify, but catch circular references
          try {
            return JSON.parse(JSON.stringify(arg));
          } catch (e) {
            return String(arg);
          }
        }
        return arg;
      } catch (e) {
        return String(arg);
      }
    });
  }

  // Helper function to check if log should be filtered out
  function shouldFilterLog(args) {
    if (!args || args.length === 0) return false;
    const firstArg = String(args[0]);
    // Filter out reconnecting-websocket debug logs (RWS>)
    if (firstArg.startsWith('RWS>')) return true;
    return false;
  }

  // Helper function to send message to parent
  function sendToParent(level, args) {
    try {
      // Filter out noisy library logs
      if (shouldFilterLog(args)) return;

      const serializedArgs = serializeArgs(args);

      // Send to parent iframe
      if (window.parent && window.parent !== window) {
        window.parent.postMessage(
          {
            type: 'POOF_CONSOLE_LOG',
            level: level,
            args: serializedArgs,
            timestamp: Date.now(),
          },
          '*',
        );
        messagesSent++;
      } else {
        // Not in an iframe - this is expected in some cases
        if (messagesFailed === 0) {
          originalConsole.warn(
            '[Console Shim] Not running in iframe - messages will not be forwarded',
          );
        }
        messagesFailed++;
      }
    } catch (e) {
      // If we can't send to parent, track the error
      messagesFailed++;
      lastError = e.message;
      // Only log the first few errors to avoid spam
      if (messagesFailed <= 3) {
        originalConsole.error('[Console Shim] Error sending message:', e);
      }
    }
  }

  // Override console methods
  console.log = function (...args) {
    sendToParent('log', args);
    originalConsole.log.apply(console, args);
  };

  console.error = function (...args) {
    sendToParent('error', args);
    originalConsole.error.apply(console, args);
  };

  console.warn = function (...args) {
    sendToParent('warn', args);
    originalConsole.warn.apply(console, args);
  };

  console.info = function (...args) {
    sendToParent('info', args);
    originalConsole.info.apply(console, args);
  };

  console.debug = function (...args) {
    // Debug logs are not captured - only output to original console
    originalConsole.debug.apply(console, args);
  };

  // Also capture uncaught errors and promise rejections
  window.addEventListener('error', function (event) {
    sendToParent('error', [event.message, event.filename, event.lineno, event.colno, event.error]);
  });

  window.addEventListener('unhandledrejection', function (event) {
    sendToParent('error', ['Unhandled Promise Rejection:', event.reason]);
  });

  // Log successful initialization (only in non-LIVE environments)
  originalConsole.log(
    '[Console Shim] Initialized successfully - console methods are being intercepted',
  );

  // Expose health check function for debugging
  window.__poofConsoleShimHealth = function () {
    return {
      active: true,
      messagesSent,
      messagesFailed,
      lastError,
      inIframe: window.parent && window.parent !== window,
    };
  };

  // Log health stats periodically (every 50 messages) for debugging
  let logCount = 0;
  const trackHealth = function () {
    logCount++;
    if (logCount % 50 === 0) {
      originalConsole.info('[Console Shim] Health check:', window.__poofConsoleShimHealth());
    }
  };

  // Override console methods with health tracking
  console.log = function (...args) {
    sendToParent('log', args);
    originalConsole.log.apply(console, args);
    trackHealth();
  };

  console.error = function (...args) {
    sendToParent('error', args);
    originalConsole.error.apply(console, args);
    trackHealth();
  };

  console.warn = function (...args) {
    sendToParent('warn', args);
    originalConsole.warn.apply(console, args);
    trackHealth();
  };

  console.info = function (...args) {
    sendToParent('info', args);
    originalConsole.info.apply(console, args);
    trackHealth();
  };

  console.debug = function (...args) {
    // Debug logs are not captured - only output to original console
    originalConsole.debug.apply(console, args);
    trackHealth();
  };

  // Network Request Monitoring
  // Store original fetch and XMLHttpRequest
  const originalFetch = window.fetch;
  const originalXHROpen = XMLHttpRequest.prototype.open;
  const originalXHRSend = XMLHttpRequest.prototype.send;

  // Helper to check if URL is related to tarobase/partyserver
  function isRelevantUrl(url) {
    if (!url) return false;
    const urlStr = url.toString().toLowerCase();
    return urlStr.includes('tarobase') || urlStr.includes('poof');
  }

  // Helper to send network request to parent
  function sendNetworkRequest(
    method,
    url,
    status,
    statusText,
    duration,
    requestBody,
    responseBody,
    error,
  ) {
    try {
      if (window.parent && window.parent !== window) {
        window.parent.postMessage(
          {
            type: 'POOF_NETWORK_REQUEST',
            method: method,
            url: url,
            status: status,
            statusText: statusText,
            duration: duration,
            requestBody: requestBody,
            responseBody: responseBody,
            error: error,
            timestamp: Date.now(),
          },
          '*',
        );
      }
    } catch (e) {
      originalConsole.error('[Network Monitor] Error sending network request:', e);
    }
  }

  // Intercept fetch
  window.fetch = function (...args) {
    const url = args[0];
    const options = args[1] || {};
    const method = (options.method || 'GET').toUpperCase();

    // Only monitor relevant URLs
    if (!isRelevantUrl(url)) {
      return originalFetch.apply(this, args);
    }

    const startTime = Date.now();
    let requestBody = null;

    // Try to capture request body
    if (options.body) {
      try {
        if (typeof options.body === 'string') {
          requestBody = options.body;
        } else {
          requestBody = JSON.stringify(options.body);
        }
      } catch (e) {
        requestBody = '[Unable to serialize request body]';
      }
    }

    return originalFetch
      .apply(this, args)
      .then((response) => {
        const duration = Date.now() - startTime;

        // Clone response to read body without consuming it
        const clonedResponse = response.clone();

        // Try to read response body
        clonedResponse
          .text()
          .then((responseText) => {
            let responseBody = responseText;
            // Try to parse as JSON for better formatting
            try {
              const json = JSON.parse(responseText);
              responseBody = JSON.stringify(json);
            } catch (e) {
              // Not JSON, keep as text
            }

            sendNetworkRequest(
              method,
              url.toString(),
              response.status,
              response.statusText,
              duration,
              requestBody,
              responseBody,
              null,
            );
          })
          .catch((err) => {
            // If we can't read the body, just send without it
            sendNetworkRequest(
              method,
              url.toString(),
              response.status,
              response.statusText,
              duration,
              requestBody,
              null,
              null,
            );
          });

        return response;
      })
      .catch((error) => {
        const duration = Date.now() - startTime;
        sendNetworkRequest(
          method,
          url.toString(),
          0,
          'Network Error',
          duration,
          requestBody,
          null,
          error.message,
        );
        throw error;
      });
  };

  // Intercept XMLHttpRequest
  XMLHttpRequest.prototype.open = function (method, url, ...rest) {
    this._poofMethod = method;
    this._poofUrl = url;
    this._poofStartTime = Date.now();
    return originalXHROpen.apply(this, [method, url, ...rest]);
  };

  XMLHttpRequest.prototype.send = function (body) {
    const xhr = this;
    const url = xhr._poofUrl;
    const method = xhr._poofMethod;

    // Only monitor relevant URLs
    if (!isRelevantUrl(url)) {
      return originalXHRSend.apply(this, arguments);
    }

    let requestBody = null;
    if (body) {
      try {
        requestBody = typeof body === 'string' ? body : JSON.stringify(body);
      } catch (e) {
        requestBody = '[Unable to serialize request body]';
      }
    }

    // Attach load handler
    const originalOnLoad = xhr.onload;
    xhr.onload = function () {
      const duration = Date.now() - xhr._poofStartTime;
      let responseBody = null;

      try {
        responseBody = xhr.responseText;
      } catch (e) {
        responseBody = '[Unable to read response]';
      }

      sendNetworkRequest(
        method,
        url,
        xhr.status,
        xhr.statusText,
        duration,
        requestBody,
        responseBody,
        null,
      );

      if (originalOnLoad) {
        originalOnLoad.apply(this, arguments);
      }
    };

    // Attach error handler
    const originalOnError = xhr.onerror;
    xhr.onerror = function () {
      const duration = Date.now() - xhr._poofStartTime;
      sendNetworkRequest(
        method,
        url,
        0,
        'Network Error',
        duration,
        requestBody,
        null,
        'Network request failed',
      );

      if (originalOnError) {
        originalOnError.apply(this, arguments);
      }
    };

    return originalXHRSend.apply(this, arguments);
  };

  originalConsole.log(
    '[Console Shim] Network monitoring initialized for tarobase/partyserver requests',
  );

  // URL Navigation Tracking
  // Helper to send URL change to parent
  function sendUrlChange(url) {
    try {
      if (window.parent && window.parent !== window) {
        window.parent.postMessage(
          {
            type: 'POOF_URL_CHANGE',
            url: url,
            path: new URL(url).pathname,
            timestamp: Date.now(),
          },
          '*',
        );
      }
    } catch (e) {
      originalConsole.error('[URL Monitor] Error sending URL change:', e);
    }
  }

  // Track current URL to avoid duplicate messages
  let lastReportedUrl = window.location.href;

  // Intercept history.pushState
  const originalPushState = history.pushState;
  history.pushState = function (...args) {
    const result = originalPushState.apply(this, args);
    const newUrl = window.location.href;
    if (newUrl !== lastReportedUrl) {
      lastReportedUrl = newUrl;
      sendUrlChange(newUrl);
    }
    return result;
  };

  // Intercept history.replaceState
  const originalReplaceState = history.replaceState;
  history.replaceState = function (...args) {
    const result = originalReplaceState.apply(this, args);
    const newUrl = window.location.href;
    if (newUrl !== lastReportedUrl) {
      lastReportedUrl = newUrl;
      sendUrlChange(newUrl);
    }
    return result;
  };

  // Listen for popstate events (back/forward button in iframe)
  window.addEventListener('popstate', function () {
    const newUrl = window.location.href;
    if (newUrl !== lastReportedUrl) {
      lastReportedUrl = newUrl;
      sendUrlChange(newUrl);
    }
  });

  // Listen for hashchange events
  window.addEventListener('hashchange', function () {
    const newUrl = window.location.href;
    if (newUrl !== lastReportedUrl) {
      lastReportedUrl = newUrl;
      sendUrlChange(newUrl);
    }
  });

  originalConsole.log('[Console Shim] URL navigation monitoring initialized');
})();
