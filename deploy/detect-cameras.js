#!/usr/bin/env node

// Camera detection script for Mac device setup
// Run this to get the device IDs for your specific camera setup

async function detectCameras() {
  console.log('🎥 Detecting available cameras...');
  
  try {
    // This would normally require a browser environment
    // For Mac device setup, we'll provide instructions instead
    console.log('\n📋 To detect your camera device IDs:');
    console.log('1. Open Chrome/Safari on the Mac device');
    console.log('2. Go to the MagnumStream dashboard');
    console.log('3. Open browser console (F12)');
    console.log('4. Run this command:');
    console.log('');
    console.log('navigator.mediaDevices.enumerateDevices().then(devices => {');
    console.log('  const cameras = devices.filter(d => d.kind === "videoinput");');
    console.log('  cameras.forEach((cam, i) => {');
    console.log('    console.log(`Camera ${i + 1}: ${cam.label}`);');
    console.log('    console.log(`Device ID: ${cam.deviceId}`);');
    console.log('    console.log("---");');
    console.log('  });');
    console.log('});');
    console.log('');
    console.log('5. Copy the device IDs and add them to your .env file');
    console.log('');
    console.log('📝 Add these lines to your .env file:');
    console.log('CAMERA_1_DEVICE_ID=your-straight-view-camera-device-id');
    console.log('CAMERA_2_DEVICE_ID=your-side-view-camera-device-id');
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

detectCameras();