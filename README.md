# London 2100 · Rhino → WebXR → Meta Quest 3

这是一个**独立网页 VR 建筑漫游测试项目**。不需要 Unreal Engine、npm、API Key 或后端服务。整个项目可以发布到 GitHub Pages，让 Meta Quest 3 / 3S 通过浏览器直接打开。

## 已经实现的功能

- 内置一个简单的建筑展亭，首次打开立即显示。
- 内附真正的 `sample-house.glb`，可测试 GLB 模型读取。
- 在电脑网页中选择或拖放 Rhino 导出的 `.glb` 文件（单文件格式）。
- Rhino 模型按真实米制比例加载：**1 Three.js 单位 = 1 m**，不自动放大/缩小；模型自动水平居中并落到地面。
- 电脑端鼠标第一人称漫游、WASD 移动。
- Quest WebXR 立体显示：头显追踪，左摇杆移动、右摇杆分段转向、手柄扳机指向地面瞬移。

**当前第一版未实现**墙体碰撞、真实物理、自动上下楼梯、多人同步、手势识别、复杂模型 LOD。VR 功能和流畅度仍需在实际 Quest 3 上验收。

## 第一步：创建新的 GitHub 仓库

1. 打开 **https://github.com/new**，Owner 选择 `HaoWang310`。
2. Repository name 输入 **`london-2100-webxr-test`**。
3. 选择 **Public**，不要预先勾选 README、`.gitignore` 等初始化选项，点击 **Create repository**。
4. 将本文件包**解压**，进入解压后文件夹，选中里面所有文件并上传至仓库根目录（`Add file → Upload files`）。**不要直接上传 ZIP，不要在仓库里再套一层文件夹。**
5. 在仓库 **Settings → Pages → Build and deployment**：
   - Source: **Deploy from a branch**
   - Branch: **main**
   - Folder: **/(root)**
   - 点击 **Save**。
6. 在 Pages 部署成功后，访问网页：`https://haowang310.github.io/london-2100-webxr-test/`。

> 此网页链接只有在你真实创建仓库并成功启用 Pages 后才会生效，当前不能当作已经上线的地址。

## 第二步：在电脑上试用

打开上面的 GitHub Pages 网页：

1. 先点击 **内置建筑** 或 **示例 GLB**。
2. 点击 **进入电脑漫游**。
3. 使用 `W/A/S/D` 移动，鼠标环顾四周，`Esc` 退出鼠标锁定。
4. 要载入你的 Rhino 模型，点击 **导入你的 GLB 文件**，或者直接拖放 `.glb` 到网页。

**重要**：在电脑浏览器导入的本地文件只存在于那一个浏览器标签页，并不会自动传给 Quest 3。如果要让 Quest 3 看同一个自定义模型，请按下方「Rhino 模型放到 Quest」操作。

## 第三步：在 Meta Quest 3 / 3S 测试

1. 头显连接 Wi-Fi，打开 **Meta Quest Browser**。
2. 进入已经部署的 HTTPS 网页。
3. 点击页面下方的 **ENTER VR**。
4. 转动头部查看建筑；左摇杆移动、右摇杆分段转向；用手柄射线指向地面后按扳机传送。
5. 使用 Quest 系统退出 VR，回到网页。

WebXR 的沉浸模式必须由兼容的 XR 设备浏览器发起。在没有 WebXR 硬件的普通电脑浏览器里，按钮显示 **VR NOT SUPPORTED** 通常属于正常现象。

## 第四步：把 Rhino 8 模型导入 Quest

1. Rhino 8 建议新建一个**单位为 Metres（米）**的文档；检查建筑真实尺寸，模型位置尽量靠近世界原点。
2. 选择需要的物体 → `Export Selected` → **GL Transmission Format (.glb)**。
3. 在导出选项中启用：
   - **Map Rhino Z to glTF Y**（非常重要；Rhino 的 Z 向上必须转换成 glTF 的 Y 向上）；
   - **Export materials**，使用合适的导出网格细分质量。
4. 为首次测试，将导出的文件重命名为 **`sample-house.glb`**。
5. 在 GitHub 新仓库中替换根目录的同名 `sample-house.glb` 文件，然后在 Quest 3 浏览器中刷新网页并点击 **示例 GLB**，即可加载你刚才从 Rhino 导出的模型。

如果只想在电脑浏览器预览，直接点击页面左侧的 GLB 上传按钮，不需要先上传 GitHub。

### 没有 Rhino 测试模型？

压缩包另附 **`Rhino8_Create_Test_Pavilion.py`**。在 Rhino 8 **新建空白文件**后，在命令行执行 `_RunPythonScript`，选择此脚本。它会建立一个约 12 × 9 m 的简单展亭，完成后你可以自己导出 GLB，验证整个 Rhino → GitHub → Quest 3 流程。

## 本地电脑预览（可选）

如果有 Python，在项目文件夹打开终端，执行：

```bash
python -m http.server 8080
```

然后访问 `http://localhost:8080/`。普通 3D 页面可以在 localhost 工作；**Quest 访问网页仍建议使用 HTTPS 的 GitHub Pages**。

本项目使用固定版本的 Three.js r180 CDN，所以需要联网加载 JavaScript 模块。

## 文件结构

```text
index.html                      网页入口
style.css                      界面样式
main.js                        建筑展示、GLB 导入、WebXR 漫游和手柄传送
sample-house.glb               真正的简单建筑 3D 示例
Rhino8_Create_Test_Pavilion.py  在 Rhino 中一键建立测试模型
.nojekyll                      GitHub Pages 文件
README.md                      本说明
```

## 常见问题

- **页面白屏**：检查是否访问 GitHub Pages 的正确地址；能否联网访问 jsDelivr CDN；打开浏览器控制台查看报错。
- **模型横着躺**：Rhino 导出时未勾选 `Map Rhino Z to glTF Y`。
- **模型极大/极小**：检查 Rhino 单位是否为米。程序不会自动修正比例错误。
- **Quest 看不到电脑刚导入的模型**：浏览器本地导入不会跨设备同步；请上传模型到 GitHub，替换 `sample-house.glb` 后用 Quest 网页重新加载。
- **VR 不能进入**：确认使用 Quest Browser，站点为 HTTPS，Quest 系统允许该站点使用 VR。
- **穿过墙壁**：首个测试版刻意没有加入碰撞处理，待确认基本漫游流程后再加。

## 官方参考

- Rhino 8 GLB 官方帮助：https://docs.mcneel.com/rhino/8mac/help/en-us/fileio/gltf_import_export.htm
- Three.js VR 官方说明：https://threejs.org/manual/#en/webxr-basics
- Meta Quest WebXR：https://developers.meta.com/vr/documentation/web/webxr-overview/
- GitHub Pages：https://docs.github.com/en/pages/getting-started-with-github-pages/configuring-a-publishing-source-for-your-github-pages-site