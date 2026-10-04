# 球馆与 Google Maps

创建与编辑球局的球馆选项按用户图片提供的11个名称：Antonio Díaz Miguel、Daoíz y Velarde、Félix Rubio、Fernando Martín、Gimnasio Moscardó、Hortaleza、La Elipa、La Fundi、Marqués de Samaranch、Orcasur、Pradillo。

选择球馆自动填入地址，地址保存到活动记录。创建、编辑时服务端也会规范所选球馆名称并填写对应地址。旧活动的非列表球馆保留为“当前记录”，可以改选新列表；不会批量改写已有活动。已识别球馆的展示与地图采用目录的标准地址。

点击表单中的地址、活动标题下的球馆，或活动说明里的地址，打开Google Maps的新页。复制接龙文本也包括地址和地图链接。使用[Google Maps官方URL格式](https://developers.google.com/maps/documentation/urls/get-started)，没有申请地图API密钥或开通付费地图服务。

地址核对日期：2026-10-04。与用户图片的主要差异是Marqués de Samaranch：图片写Paseo Imperial 18，当前[市政府球馆资料](https://www.madrid.es/portales/munimadrid/es/Inicio/Cultura-ocio-y-deporte/Publicaciones/Centro-Deportivo-Municipal-Marques-de-Samaranch/?vgnextchannel=f9e2f073808fe410VgnVCM2000000c205a0aRCRD&vgnextfmt=default&vgnextoid=6b00e8ae8d81c010VgnVCM1000000b205a0aRCRD)写20号，因此地图使用20号。

所选目录只表示名称和地址，不表示已完成预约或确认当日开放。Fernando Martín的[官网](https://www.madrid.es/portales/munimadrid/es/Inicio/El-Ayuntamiento/Fuencarral-El-Pardo/Direcciones-y-telefonos/Centro-Deportivo-Municipal-Fernando-Martin/?vgnextchannel=0593d47ffee28010VgnVCM100000dc0ca8c0RCRD&vgnextfmt=default&vgnextoid=baa7b0c40971c010VgnVCM1000000b205a0aRCRD)目前显示施工闭馆公告，选项仍按用户要求保留。

本次验证：TypeScript通过；11个Maps URL、重音名称匹配、创建与编辑时标准地址、编辑小人数上限和URL参数转义的检查通过。浏览器已选择Marqués de Samaranch、自动显示20号地址、保存虚构活动，并读取活动页两个正确的Google Maps链接。未提交真实球馆预约。
