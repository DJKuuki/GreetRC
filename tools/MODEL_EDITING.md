# 编辑无人机 GLB

输入：`assets/fpv-drone3-v3.glb`（保留的原始模型）

输出：`assets/fpv-drone3-v3-white-blue.glb`（白蓝配色，重构黑色尾座与 V 形双天线）

## 使用

在 E:\FPV 中运行：

```powershell
python tools/edit_drone.py
```

指定颜色示例（sRGB 十六进制，会转换为 glTF 使用的线性颜色）：

```powershell
python tools/edit_drone.py --white '#dbe3ed' --blue '#125bd7' --output assets/fpv-drone3-v3-white-blue.glb
```

编辑器使用 Python 标准库，并调用本地 Node.js 的 `draco3dgltf` 解码器，精确拆除与其他护件合并在同一网格中的旧尾座。`draco3dgltf` 和 `gltf-validator` 已安装在工作目录的 `node_modules` 中，不需要 Blender、NumPy 或 trimesh。校验方法：

```powershell
node tools/validate_models.cjs
node tests/model-edit.cjs
python tests/tail-geometry.py
```

第二条命令需要 `node server.cjs` 正在运行，并使用现有 Playwright 和本机 Edge。

## 修改方式

- 修改 10 个材质：白色机架/层边/电池外壳，蓝色 TPU 护件和电机装饰。
- 保留法线和其他表面贴图；对白色材质移除深色底色贴图的引用，避免相乘后仍然发黑。
- 按用户提供的参考图重新建模两根等长天线：机尾底座位于 X=±13、Y=29、Z=102，方向为 (±0.48, 0.8, 0.36)，组成对称外展的 V 形。每根长度为 120 个模型单位。
- 添加金色六角接头、黑色根部套管、细杆和多面近球形天线头，替换上一版接近平行的两根天线。
- 解码 mesh 120 的 TPU 网格，按焊接后的连通分量移除旧尾座的 1270 个顶点，其余 5613 个顶点与 UV 保留，法线归一化。移除的是完整几何，不是隐藏或改色。
- 重建连续的黑色尾部外壳，左右承载面法线分别为 (±0.48, 0.8, 0.36)，与接头和螺钉轴线一致。承载面有实际切出的安装孔、下沉倒角和孔底，金色接头及固定螺钉嵌入其中。本地 Three.js ShapeUtils 通过 `tools/triangulate-tail.mjs` 对带孔面进行三角化。机架节点使用包装层保持原始变换，新安装座归属于机架，在拆解时留在机架上。
- 尾座承载区后移 12 个模型单位，前端 Z=72–83 为厚 2.95 的连接舌，顶面 Y=33.65 贴在原白色上板底面 Y=33.7503 下方。上板末端 Z=82.5862 后采用分段曲面过渡到承载区，避免穿板、遮挡旧螺钉和挤占电子部件空间。`node tools/check-tail-joint.cjs` 可导出顶部、侧面和斜视检查图。
- `wireless` 和 `wireless-extra` 分别为左右天线，可独立拾取及拆解。
- 原 GLB 的二进制几何和贴图数据逐字节保留，但旧天线和被替换的 TPU 几何不再引用。裁剪后的 TPU、新天线和尾座以普通 glTF 几何追加到文件末尾，不重新压缩其他 Draco 网格，也没有外链贴图。

尾部专用近景预览：http://127.0.0.1:4173/tools/tail-preview.html 。可拖动旋转查看安装座各面。
- 修改后的模型有 14 个顶层部件；原始模型仍有 13 个。
- 页面默认显示新模型，左上角可以切回原始模型。新模型使用较低光照强度及 ACES 色调映射以保留白色表面细节；这些属于查看器设置，GLB 材质配色本身已写入文件。

## 校验结果与限制

原始文件和新文件均能由离线 Three.js/Draco 加载。原文件哈希及修改清单见 `artifacts/model-edit-report.json`。

glTF Validator 对原始文件已有 1 个 UV 属性错误（mesh 80 的材质引用底色贴图，但几何没有 TEXCOORD_0）和 9 个警告，新文件保持相同错误和警告数量，没有新增结构错误。该校验器不支持校验 Draco 压缩内容本身，因此另外使用实际浏览器加载及拆解测试。这里没有擅自修改原模型的摄像头纹理。

新增天线与支架是视觉造型，不表示真实射频硬件方案或可制造机械结构。原模型的来源记录仍在根目录 README.md 中。

## 固定翼运动涂装

`assets/base.obj` 保持原样，运行 `python tools/build_fixed_wing.py` 生成 `assets/fixed-wing-sport.glb` 和可编辑的 `assets/fixed-wing-sport-livery.png`。脚本使用本地 Pillow 绘制白、蓝、青、橙色涂装，保留原始三角面和法线，并把贴图嵌入 GLB；无需外部 MTL 或联网资源。原始网格是一体结构，因此固定翼模式提供旋转、缩放、点选及复位，不提供虚构的部件拆解。

浏览 `http://127.0.0.1:4173/?model=fixed-wing`，或在页面模型选择器中选择“固定翼 · 运动涂装”。验证命令为 `node tests/fixed-wing.cjs`。
