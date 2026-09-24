const fs = require('fs');
const { execSync } = require('child_process');

const files = execSync('grep -rl "propertyMembers" apps/dashboard/src/app/api/').toString().trim().split('\n');

for (const file of files) {
  if (!file) continue;
  let content = fs.readFileSync(file, 'utf8');
  
  content = content.replace(/} , propertyMembers, organizationMembers } from '@sena\/database';/g, ", propertyMembers, organizationMembers } from '@sena/database';");
  
  fs.writeFileSync(file, content);
  console.log('Fixed syntax', file);
}
