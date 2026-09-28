import fs from 'fs';
import path from 'path';

function findRoutes(dir, fileList = []) {
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const filePath = path.join(dir, file);
    if (fs.statSync(filePath).isDirectory()) {
      findRoutes(filePath, fileList);
    } else if (file === 'route.ts' || file === 'route.js') {
      fileList.push(filePath);
    }
  }
  return fileList;
}

const routes = findRoutes('src/app/api');
console.log(`Found ${routes.length} route files.`);

let methodCount = 0;
for (const route of routes) {
  const content = fs.readFileSync(route, 'utf-8');
  const methods = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'].filter(m => content.includes(`export async function ${m}`) || content.includes(`export function ${m}`));
  methodCount += methods.length;
}
console.log(`Found ${methodCount} methods.`);
