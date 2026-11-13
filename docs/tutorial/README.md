# hutian 技术教程

主教程是面向接手开发的 [开发接手手册](TECHNICAL.md)，浏览版为 [index.html](index.html)。

先读第 2、3、4、5、9 节，依次理解进程、数据库、成员写入、聊天执行和第一次代码改动。配图包含数据库 ER 图与函数调用链；源码链接附行号。

- [本机浏览入口](http://127.0.0.1:3342/)
- [只读数据库面板](http://127.0.0.1:3343/)
- [原产品流程附录](product-overview.html)

在 hutian-world 根目录执行 `node docs/tutorial/build.mjs`，从 TECHNICAL.md 和 assets 重新生成离线浏览版。构建器复用 Web 已有依赖，不新增依赖或测试框架。HTML 内嵌配图，单个文件也可离线阅读。
