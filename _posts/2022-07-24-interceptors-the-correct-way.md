---
layout: post
title: "How to Correctly Intercept Requests and Responses in RestTemplate"
date: 2022-07-24
---

In Spring Boot applications, it's common to trace and log downstream HTTP requests and responses, 
especially when using `RestTemplate`. The standard approach involves configuring a 
[RestTemplate](https://docs.spring.io/spring-framework/docs/current/javadoc-api/org/springframework/web/client/RestTemplate.html) 
bean and plugging in a custom [ClientHttpRequestInterceptor](https://docs.spring.io/spring-framework/docs/current/javadoc-api/org/springframework/http/client/ClientHttpRequestInterceptor.html).

You might start with an interceptor like this:

```kotlin
class CustomRequestInterceptor : ClientHttpRequestInterceptor {
    override fun intercept(
        request: HttpRequest,
        body: ByteArray,
        execution: ClientHttpRequestExecution
    ): ClientHttpResponse {
        var response: ClientHttpResponse? = null
        try {
            response = execution.execute(request, body)
            return resonse
        } catch (e: Exception) {
            e.printStackTrace()
            throw e
        } finally {
            logRequest(request, response)
            logResponse(response)
        }
    }
}
```

##### What's Happening in This Snippet?
1. `CustomRequestInterceptor` implements `ClientHttpRequestInterceptor`. All the magic happens in the `intercept` method.

2. `Request Interception`: Before the request is sent, you can inspect or modify the URI, headers, or body.

3. `execution.execute(...)`: sends the request and returns a `ClientHttpResponse`. If any connection-level error occurs 
(like DNS failure or connection refused), it throws an exception here.

4. `Response Interception`: After receiving the response, you log or inspect it in the `finally` block.

> Once this interceptor is registered on your RestTemplate bean, it will log requests and responses for every downstream call.

##### The Catch
At first glance, this interceptor seems solid. But in real-world microservices, where you might offload logging to a centralized service, this naive setup can betray you.

Take this line:
```kotlin
response = execution.execute(request, body)

```
You might expect this to throw on **any** timeout, but that’s not how `RestTemplate` works.

**Here's the trap:**
If a read timeout occurs (e.g., when the server delays response for too long, try `https://httpbin.org/delay/12`), 
`execution.execute(...)` may still return a response object. The exception is thrown later, when you try to read from it:
- `response.statusCode`
- `response.statusText`
- `StreamUtils.copyToString(response.body, ...)`

This means:
- Your `try/catch` around `execute(...)` will not catch read timeouts.
- Your `logResponse(...)` method might blow up silently or log nothing useful.
- You'll lose visibility into failed calls unless you explicitly handle this behavior.

###### _What's Actually going on?_
`RestTemplate` distinguishes between:
- **Connection errors**, thrown in `execute()`.
- **Read errors**, thrown later, lazily, when reading the response stream.

##### How to Handle This Properly

To robustly log request/response activity, even when read timeouts or IO errors occur, you need to wrap access to the response in its own `try/catch`.
Here's a refined version of the `intercept` method:
```kotlin
override fun intercept(
    request: HttpRequest,
    body: ByteArray,
    execution: ClientHttpRequestExecution
): ClientHttpResponse {
    var response: ClientHttpResponse? = null
    var exception: Exception? = null

    try {
        response = execution.execute(request, body)
        return response
    } catch (e: Exception) {
        exception = e
        e.printStackTrace()
        throw e
    } finally {
        logRequest(request, response)
        logResponse(response, exception)
    }
}
```

in `logResponse(...)`:
```kotlin
private fun logResponse(response: ClientHttpResponse?, exception: Exception?) {
    var statusCode = 0
    var responseBody: String? = null

    if (exception != null) {
        // Handle connection errors (e.g., UnknownHost, ConnectException)
        log.warn("Exception occurred during execution: {}", exception.message)
    } else if (response != null) {
        try {
            statusCode = response.statusCode.value()
            responseBody = StreamUtils.copyToString(response.body, Charsets.UTF_8)
        } catch (e: Exception) {
            // This is where read timeouts are caught
            log.warn("Read timeout or IO error while accessing response: {}", e.message)
        }
        // Proceed to log status code, headers, responseBody, etc.
    }

    // Send trace to logging service...
}
```

##### Final Thoughts

1. `execute()` doesn’t tell the whole story.
Connection errors are thrown early, but read timeouts happen late when interacting with the response stream.

1. Always wrap response access in `try/catch`.
This is the only way to preserve logging even when timeouts happen.

1. Log the actual exception.
A `SocketTimeoutException` with the message `"Read timed out"` is far more useful than just `statusCode = 0`

1. Use `BufferingClientHttpRequestFactory` if needed.
This allows you to read the response body multiple times without consuming it.

```kotlin
RestTemplate(
    BufferingClientHttpRequestFactory(SimpleClientHttpRequestFactory())
).apply {
    interceptors.add(CustomRequestInterceptor(loggingClient))
}
```

###### TL:DR

> Logging responses in `RestTemplate` is not trivial when dealing with timeouts.
To build resilient observability into your microservices, treat response access as a potentially fragile operation and guard it like one.

_Happy Intercepting_
