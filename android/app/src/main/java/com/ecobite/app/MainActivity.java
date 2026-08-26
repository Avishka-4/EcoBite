package com.ecobite.app;

import android.Manifest;
import android.content.pm.PackageManager;
import android.os.Bundle;
import android.webkit.PermissionRequest;
import android.webkit.WebChromeClient;
import androidx.annotation.NonNull;
import androidx.core.app.ActivityCompat;
import androidx.core.content.ContextCompat;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    private static final int MICROPHONE_PERMISSION_REQUEST_CODE = 2001;
    private PermissionRequest pendingPermissionRequest = null;

    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        // Configure WebView to properly handle microphone permission requests on-demand
        if (this.bridge != null && this.bridge.getWebView() != null) {
            this.bridge.getWebView().setWebChromeClient(new WebChromeClient() {
                @Override
                public void onPermissionRequest(final PermissionRequest request) {
                    runOnUiThread(() -> {
                        boolean needsAudio = false;
                        for (String resource : request.getResources()) {
                            if (PermissionRequest.RESOURCE_AUDIO_CAPTURE.equals(resource)) {
                                needsAudio = true;
                                break;
                            }
                        }

                        if (needsAudio) {
                            if (ContextCompat.checkSelfPermission(MainActivity.this, Manifest.permission.RECORD_AUDIO) == PackageManager.PERMISSION_GRANTED) {
                                request.grant(request.getResources());
                            } else {
                                pendingPermissionRequest = request;
                                ActivityCompat.requestPermissions(
                                    MainActivity.this,
                                    new String[]{Manifest.permission.RECORD_AUDIO},
                                    MICROPHONE_PERMISSION_REQUEST_CODE
                                );
                            }
                        } else {
                            request.grant(request.getResources());
                        }
                    });
                }
            });
        }
    }

    @Override
    public void onRequestPermissionsResult(int requestCode, @NonNull String[] permissions, @NonNull int[] grantResults) {
        super.onRequestPermissionsResult(requestCode, permissions, grantResults);
        if (requestCode == MICROPHONE_PERMISSION_REQUEST_CODE) {
            if (grantResults.length > 0 && grantResults[0] == PackageManager.PERMISSION_GRANTED) {
                if (pendingPermissionRequest != null) {
                    runOnUiThread(() -> {
                        pendingPermissionRequest.grant(pendingPermissionRequest.getResources());
                        pendingPermissionRequest = null;
                    });
                }
            } else {
                if (pendingPermissionRequest != null) {
                    runOnUiThread(() -> {
                        pendingPermissionRequest.deny();
                        pendingPermissionRequest = null;
                    });
                }
            }
        }
    }
}
