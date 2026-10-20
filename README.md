# London 2100 · WebXR Architecture Walkthrough

独立测试项目：**Rhino 8 → GLB → Three.js → WebXR → Meta Quest 3 / Quest 3S**。不使用 Unreal Engine、后端或 API Key。

## 当前状态

GitHub 仓库已包含所有第一阶段必需文件：

- `index.html`：WebXR 网页入口。
- `style.css`：暗色架构设计界面。
- `main.js`：三维建筑生成、GLB 加载、电脑漫游及 Quest VR 交互。
- `sample-house.glb`：真实的简易展亭 GLB 示例（可直接加载）。
- `Rhino8_Create_Test_Pavilion.py`：在 Rhino 8 生成约 12 × 9 m 的测试展亭。
- `.nojekyll`：GitHub Pages 静态文件支持。

## 启用 GitHub Pages（只需一次）

打开 https://github.com/HaoWang310/london-2100-webxr-test/settings/pages

1. 找到 **Build and deployment → Source**，选择 **Deploy from a branch**。
2. **Branch:** `main`，**Folder:** `/(root)`。
3. 点击 **Save**，等待 GitHub Pages 构建完成。
4. 网站地址：**https://haowang310.github.io/london-2100-webxr-test/** 。

> 第一次开启 Pages 前，上述地址可能显示 404。发布是否成功，请以 GitHub 的 Pages 页面为准。

## 电脑端测试

1. 打开已发布网页（支持 Chrome 或 Edge）。
2. 默认显示内置建筑。点击 **示例 GLB** 测试真实 GLB 资源加载。
3. 点击 **进入电脑漫游**，鼠标改变视角，使用 **W/A/S/D** 移动，**Esc** 退出。
4. 点击 **导入你的 GLB 文件**，可以直接选择电脑中的 Rhino GLB；也可以把 GLB 拖入页面。

## Meta Quest 3 / 3S 测试

1. Quest 3 接入 Wi-Fi，启动自带 **Meta Quest Browser**。
2. 输入已部署的 HTTPS 网站地址。
3. 点击 **Enter VR**。
4. 转头观察场景；左摇杆前后左右移动；右摇杆快速左右推动分段转向；手柄指向水平地面或楼板，扣扳机进行传送。
5. 使用 Quest 系统操作退出 VR。

**注意：** 普通电脑缺少 XR 硬件时显示“VR NOT SUPPORTED”属于正常情况；桌面漫游依然可以使用。

## 把自己的 Rhino 模型放进 Quest

1. 在 Rhino 8 中确认场景单位为 **Metres（米）**，不要把毫米模型直接作为米导入网页。
2. 选择建筑对象，使用 **Export Selected → GL Transmission Format (.glb)**。
3. 导出时启用 **Map Rhino Z to glTF Y**，并导出材质。GLB 应尽量优化网格和贴图。
4. **仅在电脑预览：** 在网页中点击“导入你的 GLB 文件”。
5. **让 Quest 访问同一个模型：** 将 GLB 重命名为 `sample-house.glb`，通过 GitHub 网页上传到本仓库根目录并替换同名文件；等待 Pages 发布后，在 Quest 浏览器刷新，点击“示例 GLB”。

### Rhino 无模型时

在**空白 Rhino 8 文档**运行 `_RunPythonScript`，选择仓库里的 `Rhino8_Create_Test_Pavilion.py`，生成测试建筑后按上面方法导出 GLB。

## 技术说明与第一版限制

- 单位为 **1 Three.js 单位 = 1 米**；导入 GLB 时不自动缩放。
- XR 为 `immersive-vr` + `local-floor` 参考空间；必须使用兼容的头显浏览器及 HTTPS。
- 这是功能验证原型，**尚未完成实际 Quest 3 实机验收**。
- 未加入墙壁碰撞、楼梯自动行走、多人同步、复杂场景 LOD；VR 中可以穿墙。
- 桌面选择的本地 GLB **不会自动同步至 Quest**，跨设备查看须上传 GLB 到 GitHub 或未来接入模型存储服务。
- Three.js 由固定版本 CDN 提供，因此网页需要联网。
- 如果 VR 测试按钮不可用，先确认地址为 HTTPS、Quest 浏览器支持 WebXR、Pages 部署已成功。

## 参考文档

- Three.js: https://threejs.org/manual/#en/webxr-basics
- Rhino 8 glTF 导出: https://docs.mcneel.com/rhino/8mac/help/en-us/fileio/gltf_import_export.htm
- GitHub Pages: https://docs.github.com/en/pages/getting-started-with-github-pages/configuring-a-publishing-source-for-your-github-pages-site
