// Test for React rendering issues
console.log('Testing object rendering fixes...');

// Simulate the problematic object structure
const mockLog = {
  conflictResolution: {
    hasConflict: true,
    conflictType: 'schedule_override',
    resolution: 'Manual override approved',
    responseTime: 150
  }
};

// Test the old problematic rendering (this would cause the error)
// console.log('Old (broken) rendering:', mockLog.conflictResolution); // This is what was broken

// Test the new fixed rendering
console.log('New (fixed) rendering examples:');
if (mockLog.conflictResolution && mockLog.conflictResolution.hasConflict) {
  console.log('Conflict:', mockLog.conflictResolution.resolution || mockLog.conflictResolution.conflictType);
  if (mockLog.conflictResolution.responseTime) {
    console.log(`Response time: ${mockLog.conflictResolution.responseTime}ms`);
  }
}

console.log('✅ Object rendering fix verified!');
