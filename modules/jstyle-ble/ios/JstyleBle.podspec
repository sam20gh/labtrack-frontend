Pod::Spec.new do |s|
  s.name           = 'JstyleBle'
  s.version        = '1.0.0'
  s.summary        = 'Protocol codec for J-Style 2208A and V8 health bracelets.'
  s.description    = 'Wraps the two vendor BleSDK archives. Speaks no Bluetooth.'
  s.author         = 'LabTrack'
  s.homepage       = 'https://labtrack.app'
  s.platforms      = { :ios => '15.1' }
  s.source         = { git: '' }
  s.static_framework = true

  s.dependency 'ExpoModulesCore'

  # ── The vendor archives ───────────────────────────────────────────────────
  #
  # Both are `arm64` and neither carries a simulator slice, which `lipo -info` confirms.
  # **So a target that links this pod cannot build for the iOS simulator at all** — not as
  # a setting to flip, but because the code for that architecture does not exist. Excluding
  # arm64 for the simulator does not help either; it would fall back to x86_64, which is
  # equally absent.
  #
  # Everything that touches a bracelet therefore has to be exercised on a physical device.
  # The JS side is built so that this is the only thing lost: `isAvailable()` returns false
  # wherever the native module is missing, so the simulator behaves like a phone with no
  # bracelet paired rather than crashing on launch.
  s.vendored_libraries = 'vendor/j2208a/libBleSDK_J2208A.a', 'vendor/v8/libBleSDK_V8.a'
  s.preserve_paths     = 'vendor/**/*'

  s.pod_target_xcconfig = {
    'DEFINES_MODULE' => 'YES',
    'SWIFT_INCLUDE_PATHS' => '"$(PODS_TARGET_SRCROOT)/vendor"',
    'HEADER_SEARCH_PATHS' => '"$(PODS_TARGET_SRCROOT)/vendor"',
  }

  s.source_files = '*.{h,m,mm,swift}'
end
