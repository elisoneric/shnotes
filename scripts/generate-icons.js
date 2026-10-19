const fs = require("fs");
const path = require("path");
const sharp = require("sharp");

async function generate() {
  const svgPath = path.join(__dirname, "../public/logo.svg");
  const svgBuffer = fs.readFileSync(svgPath);

  // 1. Web Public Icons
  await sharp(svgBuffer).resize(192, 192).png().toFile(path.join(__dirname, "../public/icon-192.png"));
  console.log("Generated public/icon-192.png");

  await sharp(svgBuffer).resize(512, 512).png().toFile(path.join(__dirname, "../public/icon-512.png"));
  console.log("Generated public/icon-512.png");

  await sharp(svgBuffer).resize(32, 32).png().toFile(path.join(__dirname, "../public/favicon.ico"));
  console.log("Generated public/favicon.ico");

  // 2. Electron App Icon
  const electronDir = path.join(__dirname, "../electron");
  if (fs.existsSync(electronDir)) {
    await sharp(svgBuffer).resize(256, 256).png().toFile(path.join(electronDir, "icon.png"));
    console.log("Generated electron/icon.png");
  }

  // 3. Android Mipmaps
  const resDir = path.join(__dirname, "../android/app/src/main/res");
  if (fs.existsSync(resDir)) {
    const androidSizes = [
      { dir: "mipmap-mdpi", size: 48 },
      { dir: "mipmap-hdpi", size: 72 },
      { dir: "mipmap-xhdpi", size: 96 },
      { dir: "mipmap-xxhdpi", size: 144 },
      { dir: "mipmap-xxxhdpi", size: 192 },
    ];

    for (const item of androidSizes) {
      const targetDir = path.join(resDir, item.dir);
      if (fs.existsSync(targetDir)) {
        await sharp(svgBuffer).resize(item.size, item.size).png().toFile(path.join(targetDir, "ic_launcher.png"));
        await sharp(svgBuffer).resize(item.size, item.size).png().toFile(path.join(targetDir, "ic_launcher_round.png"));
        await sharp(svgBuffer).resize(item.size, item.size).png().toFile(path.join(targetDir, "ic_launcher_foreground.png"));
        console.log(`Generated Android ${item.dir} (${item.size}px)`);
      }
    }
  }

  console.log("All icons successfully generated.");
}

generate().catch(console.error);
