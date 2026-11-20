plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.android")
}

android {
    namespace = "com.nexuscore.ai"
    compileSdk = 35

    defaultConfig {
        applicationId = "com.nexuscore.ai"
        minSdk = 30
        targetSdk = 35
        versionCode = 1
        versionName = "0.1.0"

    }

    buildTypes {
        release {
            isMinifyEnabled = false
            proguardFiles(
                getDefaultProguardFile("proguard-android-optimize.txt"),
                "proguard-rules.pro"
            )
        }
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }

    kotlinOptions {
        jvmTarget = "17"
    }
}

// React/Vite sources live beside the Android project in ../frontend.
// The Android app has a small offline-safe web shell already bundled in assets/www.
// After running `npm install` and `npm run build` in ../frontend, use
// `npm run sync-android` there to copy the real React build into this app.
