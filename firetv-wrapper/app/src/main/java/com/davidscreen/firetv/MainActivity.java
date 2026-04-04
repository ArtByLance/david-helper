package com.davidscreen.firetv;

import android.annotation.SuppressLint;
import android.graphics.Bitmap;
import android.net.Uri;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.view.View;
import android.view.WindowManager;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceError;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.Button;
import android.widget.TextView;

import androidx.annotation.NonNull;
import androidx.annotation.Nullable;
import androidx.appcompat.app.AppCompatActivity;
import androidx.core.view.WindowCompat;
import androidx.core.view.WindowInsetsCompat;
import androidx.core.view.WindowInsetsControllerCompat;

/**
 * Thin Fire TV wrapper for the hosted David Screen dashboard.
 *
 * This activity is intentionally boring.
 * Its whole job is: open one URL, stay full screen, and recover cleanly if the
 * network blinks.
 */
public class MainActivity extends AppCompatActivity {
  private WebView webView;
  private View fallbackView;
  private Button retryButton;
  private TextView fallbackMessage;

  private final Handler handler = new Handler(Looper.getMainLooper());
  private final Uri allowedUri = Uri.parse(AppConfig.DASHBOARD_URL);

  private final Runnable loadTimeoutRunnable = this::showReconnectScreen;
  private final Runnable autoRetryRunnable = this::loadDashboard;

  private boolean pageLoaded = false;

  @Override
  protected void onCreate(@Nullable Bundle savedInstanceState) {
    super.onCreate(savedInstanceState);

    WindowCompat.setDecorFitsSystemWindows(getWindow(), false);
    getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);

    setContentView(R.layout.activity_main);

    webView = findViewById(R.id.dashboard_webview);
    fallbackView = findViewById(R.id.fallback_screen);
    retryButton = findViewById(R.id.retry_button);
    fallbackMessage = findViewById(R.id.fallback_message);

    retryButton.setOnClickListener(v -> loadDashboard());

    configureWebView();
    loadDashboard();
  }

  @Override
  protected void onResume() {
    super.onResume();
    applyImmersiveMode();
    webView.onResume();
    webView.resumeTimers();

    if (getCurrentUri() == null) {
      loadDashboard();
    }
  }

  @Override
  protected void onPause() {
    webView.onPause();
    webView.pauseTimers();
    super.onPause();
  }

  @Override
  protected void onDestroy() {
    handler.removeCallbacksAndMessages(null);

    if (webView != null) {
      webView.stopLoading();
      webView.destroy();
    }

    super.onDestroy();
  }

  @Override
  public void onWindowFocusChanged(boolean hasFocus) {
    super.onWindowFocusChanged(hasFocus);
    if (hasFocus) {
      applyImmersiveMode();
    }
  }

  @Override
  public void onBackPressed() {
    Uri currentUri = getCurrentUri();

    if (webView.canGoBack() && isAllowedUrl(currentUri) && !isHomeUrl(currentUri)) {
      webView.goBack();
      return;
    }

    // On TV this is calmer than kicking the user out by accident.
    // If we are already at "home", Back just does nothing.
  }

  @SuppressLint("SetJavaScriptEnabled")
  private void configureWebView() {
    WebSettings settings = webView.getSettings();
    settings.setJavaScriptEnabled(true);
    settings.setDomStorageEnabled(true);
    settings.setDatabaseEnabled(true);
    settings.setAllowFileAccess(false);
    settings.setAllowContentAccess(false);
    settings.setBuiltInZoomControls(false);
    settings.setDisplayZoomControls(false);
    settings.setSupportZoom(false);
    settings.setUseWideViewPort(true);
    settings.setLoadWithOverviewMode(true);
    settings.setMediaPlaybackRequiresUserGesture(false);
    settings.setSupportMultipleWindows(false);

    webView.setVerticalScrollBarEnabled(false);
    webView.setHorizontalScrollBarEnabled(false);
    webView.setOverScrollMode(View.OVER_SCROLL_NEVER);
    webView.setFocusable(false);
    webView.setFocusableInTouchMode(false);
    webView.setLongClickable(false);
    webView.setKeepScreenOn(true);
    webView.setOnLongClickListener(v -> true);

    webView.setWebChromeClient(new WebChromeClient() {
      @Override
      public boolean onCreateWindow(
        WebView view,
        boolean isDialog,
        boolean isUserGesture,
        android.os.Message resultMsg
      ) {
        return false;
      }
    });

    webView.setWebViewClient(new WebViewClient() {
      @Override
      public boolean shouldOverrideUrlLoading(
        @NonNull WebView view,
        @NonNull WebResourceRequest request
      ) {
        Uri requestUri = request.getUrl();
        return !isAllowedUrl(requestUri);
      }

      @Override
      public void onPageStarted(WebView view, String url, Bitmap favicon) {
        super.onPageStarted(view, url, favicon);
        pageLoaded = false;
        hideReconnectScreen();
        handler.removeCallbacks(loadTimeoutRunnable);
        handler.postDelayed(loadTimeoutRunnable, AppConfig.LOAD_TIMEOUT_MS);
      }

      @Override
      public void onPageFinished(WebView view, String url) {
        super.onPageFinished(view, url);
        pageLoaded = true;
        handler.removeCallbacks(loadTimeoutRunnable);
        hideReconnectScreen();
      }

      @Override
      public void onReceivedError(
        @NonNull WebView view,
        @NonNull WebResourceRequest request,
        @NonNull WebResourceError error
      ) {
        super.onReceivedError(view, request, error);
        if (request.isForMainFrame()) {
          showReconnectScreen();
        }
      }

      @Override
      public void onReceivedHttpError(
        @NonNull WebView view,
        @NonNull WebResourceRequest request,
        @NonNull WebResourceResponse errorResponse
      ) {
        super.onReceivedHttpError(view, request, errorResponse);
        if (request.isForMainFrame() && errorResponse.getStatusCode() >= 400) {
          showReconnectScreen();
        }
      }
    });
  }

  private void loadDashboard() {
    handler.removeCallbacks(loadTimeoutRunnable);
    handler.removeCallbacks(autoRetryRunnable);
    pageLoaded = false;
    hideReconnectScreen();

    Uri currentUri = getCurrentUri();
    if (isAllowedUrl(currentUri)) {
      webView.reload();
    } else {
      webView.loadUrl(AppConfig.DASHBOARD_URL);
    }

    handler.postDelayed(loadTimeoutRunnable, AppConfig.LOAD_TIMEOUT_MS);
  }

  private void showReconnectScreen() {
    if (pageLoaded) {
      return;
    }

    fallbackMessage.setText(R.string.reconnecting_message);
    fallbackView.setVisibility(View.VISIBLE);
    retryButton.requestFocus();

    handler.removeCallbacks(loadTimeoutRunnable);
    handler.removeCallbacks(autoRetryRunnable);
    handler.postDelayed(autoRetryRunnable, AppConfig.AUTO_RETRY_MS);
  }

  private void hideReconnectScreen() {
    fallbackView.setVisibility(View.GONE);
    handler.removeCallbacks(autoRetryRunnable);
  }

  private void applyImmersiveMode() {
    WindowInsetsControllerCompat controller =
      WindowCompat.getInsetsController(getWindow(), getWindow().getDecorView());

    if (controller == null) {
      return;
    }

    controller.hide(WindowInsetsCompat.Type.systemBars());
    controller.setSystemBarsBehavior(
      WindowInsetsControllerCompat.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE
    );
  }

  private boolean isAllowedUrl(@Nullable Uri uri) {
    if (uri == null) {
      return false;
    }

    String scheme = uri.getScheme();
    if (scheme == null || (!"https".equalsIgnoreCase(scheme) && !"http".equalsIgnoreCase(scheme))) {
      return false;
    }

    return allowedUri.getHost() != null && allowedUri.getHost().equalsIgnoreCase(uri.getHost());
  }

  private boolean isHomeUrl(@Nullable Uri uri) {
    return uri != null && AppConfig.DASHBOARD_URL.equals(uri.toString());
  }

  @Nullable
  private Uri getCurrentUri() {
    String currentUrl = webView.getUrl();
    if (currentUrl == null || currentUrl.isBlank()) {
      return null;
    }
    return Uri.parse(currentUrl);
  }
}
