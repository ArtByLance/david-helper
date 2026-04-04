package com.davidscreen.firetv;

/**
 * One place for the app bits that are most likely to change later.
 *
 * Real-world version:
 * if you ever need to update the hosted dashboard URL, this is the first file
 * to open instead of digging through the app.
 */
public final class AppConfig {
  private AppConfig() {}

  public static final String DASHBOARD_URL = "https://YOUR-REAL-URL-HERE";
  public static final int LOAD_TIMEOUT_MS = 15000;
  public static final int AUTO_RETRY_MS = 20000;
}

