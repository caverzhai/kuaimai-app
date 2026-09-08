import { useState, useEffect } from 'react';

// 简化的省市区数据（实际项目中可以使用完整的省市区数据）
const REGIONS = [
  {
    province: '北京市',
    cities: [
      { city: '北京市', districts: ['东城区', '西城区', '朝阳区', '丰台区', '石景山区', '海淀区', '门头沟区', '房山区', '通州区', '顺义区', '昌平区', '大兴区', '怀柔区', '平谷区', '密云区', '延庆区'] }
    ]
  },
  {
    province: '上海市',
    cities: [
      { city: '上海市', districts: ['黄浦区', '徐汇区', '长宁区', '静安区', '普陀区', '虹口区', '杨浦区', '闵行区', '宝山区', '嘉定区', '浦东新区', '金山区', '松江区', '青浦区', '奉贤区', '崇明区'] }
    ]
  },
  {
    province: '广东省',
    cities: [
      { city: '广州市', districts: ['荔湾区', '越秀区', '海珠区', '天河区', '白云区', '黄埔区', '番禺区', '花都区', '南沙区', '从化区', '增城区'] },
      { city: '深圳市', districts: ['罗湖区', '福田区', '南山区', '宝安区', '龙岗区', '盐田区', '龙华区', '坪山区', '光明区'] },
      { city: '珠海市', districts: ['香洲区', '斗门区', '金湾区'] },
      { city: '汕头市', districts: ['龙湖区', '金平区', '濠江区', '潮阳区', '潮南区', '澄海区', '南澳县'] },
      { city: '佛山市', districts: ['禅城区', '南海区', '顺德区', '三水区', '高明区'] },
      { city: '韶关市', districts: ['武江区', '浈江区', '曲江区', '始兴县', '仁化县', '翁源县', '乳源瑶族自治县', '新丰县', '乐昌市', '南雄市'] },
      { city: '湛江市', districts: ['赤坎区', '霞山区', '坡头区', '麻章区', '遂溪县', '徐闻县', '廉江市', '雷州市', '吴川市'] },
      { city: '肇庆市', districts: ['端州区', '鼎湖区', '高要区', '广宁县', '怀集县', '封开县', '德庆县', '四会市'] },
      { city: '江门市', districts: ['蓬江区', '江海区', '新会区', '台山市', '开平市', '鹤山市', '恩平市'] },
      { city: '茂名市', districts: ['茂南区', '电白区', '高州市', '化州市', '信宜市'] },
      { city: '惠州市', districts: ['惠城区', '惠阳区', '博罗县', '惠东县', '龙门县'] },
      { city: '梅州市', districts: ['梅江区', '梅县区', '大埔县', '丰顺县', '五华县', '平远县', '蕉岭县', '兴宁市'] },
      { city: '汕尾市', districts: ['城区', '海丰县', '陆河县', '陆丰市'] },
      { city: '河源市', districts: ['源城区', '紫金县', '龙川县', '连平县', '和平县', '东源县'] },
      { city: '阳江市', districts: ['江城区', '阳东区', '阳西县', '阳春市'] },
      { city: '清远市', districts: ['清城区', '清新区', '佛冈县', '阳山县', '连山壮族瑶族自治县', '连南瑶族自治县', '英德市', '连州市'] },
      { city: '东莞市', districts: ['东城街道', '南城街道', '万江街道', '莞城街道', '石碣镇', '石龙镇', '茶山镇', '石排镇', '企石镇', '横沥镇', '桥头镇', '谢岗镇', '东坑镇', '常平镇', '寮步镇', '樟木头镇', '大朗镇', '黄江镇', '清溪镇', '塘厦镇', '凤岗镇', '大岭山镇', '长安镇', '虎门镇', '厚街镇', '沙田镇', '道滘镇', '洪梅镇', '麻涌镇', '望牛墩镇', '中堂镇', '高埗镇'] },
      { city: '中山市', districts: ['石岐街道', '东区街道', '西区街道', '南区街道', '五桂山街道', '火炬开发区', '小榄镇', '古镇镇', '横栏镇', '东升镇', '港口镇', '沙溪镇', '大涌镇', '黄圃镇', '南头镇', '东凤镇', '阜沙镇', '三角镇', '民众镇', '南朗镇', '三乡镇', '板芙镇', '神湾镇', '坦洲镇'] },
      { city: '潮州市', districts: ['湘桥区', '潮安区', '饶平县'] },
      { city: '揭阳市', districts: ['榕城区', '揭东区', '揭西县', '惠来县', '普宁市'] },
      { city: '云浮市', districts: ['云城区', '云安区', '新兴县', '郁南县', '罗定市'] },
    ]
  },
  {
    province: '浙江省',
    cities: [
      { city: '杭州市', districts: ['上城区', '拱墅区', '西湖区', '滨江区', '萧山区', '余杭区', '临平区', '钱塘区', '富阳区', '临安区', '桐庐县', '淳安县', '建德市'] },
      { city: '宁波市', districts: ['海曙区', '江北区', '北仑区', '镇海区', '鄞州区', '奉化区', '余姚市', '慈溪市', '象山县', '宁海县'] },
      { city: '温州市', districts: ['鹿城区', '龙湾区', '瓯海区', '洞头区', '瑞安市', '乐清市', '龙港市', '永嘉县', '平阳县', '苍南县', '文成县', '泰顺县'] },
    ]
  },
  {
    province: '江苏省',
    cities: [
      { city: '南京市', districts: ['玄武区', '秦淮区', '建邺区', '鼓楼区', '浦口区', '栖霞区', '雨花台区', '江宁区', '六合区', '溧水区', '高淳区'] },
      { city: '苏州市', districts: ['姑苏区', '虎丘区', '吴中区', '相城区', '吴江区', '常熟市', '张家港市', '昆山市', '太仓市'] },
      { city: '无锡市', districts: ['锡山区', '惠山区', '滨湖区', '梁溪区', '新吴区', '江阴市', '宜兴市'] },
    ]
  },
  {
    province: '四川省',
    cities: [
      { city: '成都市', districts: ['锦江区', '青羊区', '金牛区', '武侯区', '成华区', '龙泉驿区', '青白江区', '新都区', '温江区', '双流区', '郫都区', '新津区', '金堂县', '大邑县', '蒲江县', '都江堰市', '彭州市', '邛崃市', '崇州市', '简阳市'] },
      { city: '绵阳市', districts: ['涪城区', '游仙区', '安州区', '三台县', '盐亭县', '梓潼县', '北川羌族自治县', '平武县', '江油市'] },
    ]
  },
  {
    province: '湖北省',
    cities: [
      { city: '武汉市', districts: ['江岸区', '江汉区', '硚口区', '汉阳区', '武昌区', '青山区', '洪山区', '东西湖区', '汉南区', '蔡甸区', '江夏区', '黄陂区', '新洲区'] },
      { city: '宜昌市', districts: ['西陵区', '伍家岗区', '点军区', '猇亭区', '夷陵区', '远安县', '兴山县', '秭归县', '长阳土家族自治县', '五峰土家族自治县', '宜都市', '当阳市', '枝江市'] },
    ]
  },
  {
    province: '湖南省',
    cities: [
      { city: '长沙市', districts: ['芙蓉区', '天心区', '岳麓区', '开福区', '雨花区', '望城区', '长沙县', '浏阳市', '宁乡市'] },
      { city: '株洲市', districts: ['荷塘区', '芦淞区', '石峰区', '天元区', '渌口区', '攸县', '茶陵县', '炎陵县', '醴陵市'] },
    ]
  },
  {
    province: '河南省',
    cities: [
      { city: '郑州市', districts: ['中原区', '二七区', '管城回族区', '金水区', '上街区', '惠济区', '中牟县', '巩义市', '荥阳市', '新密市', '新郑市', '登封市'] },
      { city: '洛阳市', districts: ['老城区', '西工区', '瀍河回族区', '涧西区', '吉利区', '洛龙区', '孟津区', '新安县', '栾川县', '嵩县', '汝阳县', '宜阳县', '洛宁县', '伊川县', '偃师区'] },
    ]
  },
  {
    province: '河北省',
    cities: [
      { city: '石家庄市', districts: ['长安区', '桥西区', '新华区', '井陉矿区', '裕华区', '藁城区', '鹿泉区', '栾城区', '井陉县', '正定县', '行唐县', '灵寿县', '高邑县', '深泽县', '赞皇县', '无极县', '平山县', '元氏县', '赵县', '辛集市', '晋州市', '新乐市'] },
      { city: '唐山市', districts: ['路南区', '路北区', '古冶区', '开平区', '丰南区', '丰润区', '曹妃甸区', '滦南县', '乐亭县', '迁西县', '玉田县', '遵化市', '迁安市', '滦州市'] },
    ]
  },
  {
    province: '山东省',
    cities: [
      { city: '济南市', districts: ['历下区', '市中区', '槐荫区', '天桥区', '历城区', '长清区', '章丘区', '济阳区', '莱芜区', '钢城区', '平阴县', '商河县'] },
      { city: '青岛市', districts: ['市南区', '市北区', '黄岛区', '崂山区', '李沧区', '城阳区', '即墨区', '胶州市', '平度市', '莱西市'] },
    ]
  },
  {
    province: '山西省',
    cities: [
      { city: '太原市', districts: ['小店区', '迎泽区', '杏花岭区', '尖草坪区', '万柏林区', '晋源区', '清徐县', '阳曲县', '娄烦县', '古交市'] },
      { city: '大同市', districts: ['新荣区', '平城区', '云冈区', '云州区', '阳高县', '天镇县', '广灵县', '灵丘县', '浑源县', '左云县'] },
    ]
  },
  {
    province: '陕西省',
    cities: [
      { city: '西安市', districts: ['新城区', '碑林区', '莲湖区', '灞桥区', '未央区', '雁塔区', '阎良区', '临潼区', '长安区', '高陵区', '鄠邑区', '蓝田县', '周至县'] },
      { city: '宝鸡市', districts: ['渭滨区', '金台区', '陈仓区', '凤翔区', '岐山县', '扶风县', '眉县', '陇县', '千阳县', '麟游县', '凤县', '太白县'] },
    ]
  },
  {
    province: '辽宁省',
    cities: [
      { city: '沈阳市', districts: ['和平区', '沈河区', '大东区', '皇姑区', '铁西区', '苏家屯区', '浑南区', '沈北新区', '于洪区', '辽中区', '康平县', '法库县', '新民市'] },
      { city: '大连市', districts: ['中山区', '西岗区', '沙河口区', '甘井子区', '旅顺口区', '金州区', '普兰店区', '长海县', '瓦房店市', '庄河市'] },
    ]
  },
  {
    province: '吉林省',
    cities: [
      { city: '长春市', districts: ['南关区', '宽城区', '朝阳区', '二道区', '绿园区', '双阳区', '九台区', '农安县', '榆树市', '德惠市', '公主岭市'] },
      { city: '吉林市', districts: ['昌邑区', '龙潭区', '船营区', '丰满区', '永吉县', '蛟河市', '桦甸市', '舒兰市', '磐石市'] },
    ]
  },
  {
    province: '黑龙江省',
    cities: [
      { city: '哈尔滨市', districts: ['道里区', '南岗区', '道外区', '平房区', '松北区', '香坊区', '呼兰区', '阿城区', '双城区', '依兰县', '方正县', '宾县', '巴彦县', '木兰县', '通河县', '延寿县', '尚志市', '五常市'] },
      { city: '齐齐哈尔市', districts: ['龙沙区', '建华区', '铁锋区', '昂昂溪区', '富拉尔基区', '碾子山区', '梅里斯达斡尔族区', '龙江县', '依安县', '泰来县', '甘南县', '富裕县', '克山县', '克东县', '拜泉县', '讷河市'] },
    ]
  },
  {
    province: '安徽省',
    cities: [
      { city: '合肥市', districts: ['瑶海区', '庐阳区', '蜀山区', '包河区', '长丰县', '肥东县', '肥西县', '庐江县', '巢湖市'] },
      { city: '芜湖市', districts: ['镜湖区', '弋江区', '鸠江区', '三山区', '芜湖县', '繁昌县', '南陵县', '无为市'] },
    ]
  },
  {
    province: '福建省',
    cities: [
      { city: '福州市', districts: ['鼓楼区', '台江区', '仓山区', '马尾区', '晋安区', '长乐区', '闽侯县', '连江县', '罗源县', '闽清县', '永泰县', '平潭县', '福清市'] },
      { city: '厦门市', districts: ['思明区', '海沧区', '湖里区', '集美区', '同安区', '翔安区'] },
    ]
  },
  {
    province: '江西省',
    cities: [
      { city: '南昌市', districts: ['东湖区', '西湖区', '青云谱区', '青山湖区', '新建区', '红谷滩区', '南昌县', '安义县', '进贤县'] },
      { city: '赣州市', districts: ['章贡区', '南康区', '赣县区', '信丰县', '大余县', '上犹县', '崇义县', '安远县', '定南县', '全南县', '宁都县', '于都县', '兴国县', '会昌县', '寻乌县', '石城县', '瑞金市'] },
    ]
  },
  {
    province: '广西壮族自治区',
    cities: [
      { city: '南宁市', districts: ['兴宁区', '青秀区', '江南区', '西乡塘区', '良庆区', '邕宁区', '武鸣区', '隆安县', '马山县', '上林县', '宾阳县', '横州市'] },
      { city: '柳州市', districts: ['城中区', '鱼峰区', '柳南区', '柳北区', '柳江区', '柳城县', '鹿寨县', '融安县', '融水苗族自治县', '三江侗族自治县'] },
    ]
  },
  {
    province: '海南省',
    cities: [
      { city: '海口市', districts: ['秀英区', '龙华区', '琼山区', '美兰区'] },
      { city: '三亚市', districts: ['海棠区', '吉阳区', '天涯区', '崖州区'] },
    ]
  },
  {
    province: '重庆市',
    cities: [
      { city: '重庆市', districts: ['万州区', '涪陵区', '渝中区', '大渡口区', '江北区', '沙坪坝区', '九龙坡区', '南岸区', '北碚区', '綦江区', '大足区', '渝北区', '巴南区', '黔江区', '长寿区', '江津区', '合川区', '永川区', '南川区', '璧山区', '铜梁区', '潼南区', '荣昌区', '开州区', '梁平区', '武隆区'] }
    ]
  },
  {
    province: '天津市',
    cities: [
      { city: '天津市', districts: ['和平区', '河东区', '河西区', '南开区', '河北区', '红桥区', '东丽区', '西青区', '津南区', '北辰区', '武清区', '宝坻区', '滨海新区', '宁河区', '静海区', '蓟州区'] }
    ]
  },
  {
    province: '内蒙古自治区',
    cities: [
      { city: '呼和浩特市', districts: ['新城区', '回民区', '玉泉区', '赛罕区', '土默特左旗', '托克托县', '和林格尔县', '清水河县', '武川县'] },
      { city: '包头市', districts: ['东河区', '昆都仑区', '青山区', '石拐区', '白云鄂博矿区', '九原区', '土默特右旗', '固阳县', '达尔罕茂明安联合旗'] },
    ]
  },
  {
    province: '贵州省',
    cities: [
      { city: '贵阳市', districts: ['南明区', '云岩区', '花溪区', '乌当区', '白云区', '观山湖区', '开阳县', '息烽县', '修文县', '清镇市'] },
      { city: '遵义市', districts: ['红花岗区', '汇川区', '播州区', '桐梓县', '绥阳县', '正安县', '道真仡佬族苗族自治县', '务川仡佬族苗族自治县', '凤冈县', '湄潭县', '余庆县', '习水县', '赤水市', '仁怀市'] },
    ]
  },
  {
    province: '云南省',
    cities: [
      { city: '昆明市', districts: ['五华区', '盘龙区', '官渡区', '西山区', '东川区', '呈贡区', '晋宁区', '富民县', '宜良县', '石林彝族自治县', '嵩明县', '禄劝彝族苗族自治县', '寻甸回族彝族自治县', '安宁市'] },
      { city: '大理白族自治州', districts: ['大理市', '漾濞彝族自治县', '祥云县', '宾川县', '弥渡县', '南涧彝族自治县', '巍山彝族回族自治县', '永平县', '云龙县', '洱源县', '剑川县', '鹤庆县'] },
    ]
  },
  {
    province: '西藏自治区',
    cities: [
      { city: '拉萨市', districts: ['城关区', '堆龙德庆区', '达孜区', '林周县', '当雄县', '尼木县', '曲水县', '墨竹工卡县'] },
    ]
  },
  {
    province: '甘肃省',
    cities: [
      { city: '兰州市', districts: ['城关区', '七里河区', '西固区', '安宁区', '红古区', '永登县', '皋兰县', '榆中县'] },
      { city: '天水市', districts: ['秦州区', '麦积区', '清水县', '秦安县', '甘谷县', '武山县', '张家川回族自治县'] },
    ]
  },
  {
    province: '青海省',
    cities: [
      { city: '西宁市', districts: ['城东区', '城中区', '城西区', '城北区', '湟中区', '大通回族土族自治县', '湟源县'] },
    ]
  },
  {
    province: '宁夏回族自治区',
    cities: [
      { city: '银川市', districts: ['兴庆区', '西夏区', '金凤区', '永宁县', '贺兰县', '灵武市'] },
      { city: '石嘴山市', districts: ['大武口区', '惠农区', '平罗县'] },
    ]
  },
  {
    province: '新疆维吾尔自治区',
    cities: [
      { city: '乌鲁木齐市', districts: ['天山区', '沙依巴克区', '新市区', '水磨沟区', '头屯河区', '达坂城区', '米东区', '乌鲁木齐县'] },
      { city: '喀什地区', districts: ['喀什市', '疏附县', '疏勒县', '英吉沙县', '泽普县', '莎车县', '叶城县', '麦盖提县', '岳普湖县', '伽师县', '巴楚县', '塔什库尔干塔吉克自治县'] },
    ]
  },
  {
    province: '香港特别行政区',
    cities: [
      { city: '香港岛', districts: ['中西区', '湾仔区', '东区', '南区'] },
      { city: '九龙', districts: ['油尖旺区', '深水埗区', '九龙城区', '黄大仙区', '观塘区'] },
      { city: '新界', districts: ['荃湾区', '屯门区', '元朗区', '北区', '大埔区', '西贡区', '沙田区', '葵青区', '离岛区'] },
    ]
  },
  {
    province: '澳门特别行政区',
    cities: [
      { city: '澳门半岛', districts: ['花地玛堂区', '圣安多尼堂区', '大堂区', '望德堂区', '风顺堂区'] },
      { city: '离岛', districts: ['嘉模堂区', '圣方济各堂区', '路氹城'] },
    ]
  },
  {
    province: '台湾省',
    cities: [
      { city: '台北市', districts: ['中正区', '大同区', '中山区', '松山区', '大安区', '万华区', '信义区', '士林区', '北投区', '内湖区', '南港区', '文山区'] },
      { city: '高雄市', districts: ['楠梓区', '左营区', '鼓山区', '三民区', '盐埕区', '前金区', '新兴区', '苓雅区', '前镇区', '旗津区', '小港区', '凤山区', '林园区', '大寮区', '鸟松区', '仁武区', '大树区', '大社区', '冈山区', '桥头区', '燕巢区', '田寮区', '阿莲区', '路竹区', '湖内区', '茄萣区', '永安区', '弥陀区', '梓官区', '旗山区', '美浓区', '六龟区', '甲仙区', '杉林区', '内门区', '茂林区', '桃源区', '那玛夏区'] },
    ]
  },
];

interface RegionSelectorProps {
  value: string; // 格式：省/市/区
  onChange: (value: string) => void;
}

export function RegionSelector({ value, onChange }: RegionSelectorProps) {
  const [province, setProvince] = useState('');
  const [city, setCity] = useState('');
  const [district, setDistrict] = useState('');

  // 初始化：从 value 中解析省市区
  useEffect(() => {
    if (value) {
      const parts = value.split('/');
      if (parts.length >= 1) setProvince(parts[0]);
      if (parts.length >= 2) setCity(parts[1]);
      if (parts.length >= 3) setDistrict(parts[2]);
    }
  }, [value]);

  // 获取城市列表
  const cities = province
    ? REGIONS.find((r) => r.province === province)?.cities || []
    : [];

  // 获取区县列表
  const districts = city
    ? cities.find((c) => c.city === city)?.districts || []
    : [];

  const handleProvinceChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newProvince = e.target.value;
    setProvince(newProvince);
    setCity('');
    setDistrict('');
    if (newProvince) {
      onChange(newProvince);
    } else {
      onChange('');
    }
  };

  const handleCityChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newCity = e.target.value;
    setCity(newCity);
    setDistrict('');
    if (newCity) {
      onChange(`${province}/${newCity}`);
    } else {
      onChange(province);
    }
  };

  const handleDistrictChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newDistrict = e.target.value;
    setDistrict(newDistrict);
    if (newDistrict) {
      onChange(`${province}/${city}/${newDistrict}`);
    } else {
      onChange(`${province}/${city}`);
    }
  };

  return (
    <div className="grid grid-cols-3 gap-2">
      <select
        value={province}
        onChange={handleProvinceChange}
        className="w-full px-2 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-100 bg-white"
      >
        <option value="">选择省份</option>
        {REGIONS.map((r) => (
          <option key={r.province} value={r.province}>
            {r.province}
          </option>
        ))}
      </select>

      <select
        value={city}
        onChange={handleCityChange}
        disabled={!province}
        className="w-full px-2 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-100 bg-white disabled:bg-gray-50 disabled:text-gray-400"
      >
        <option value="">选择城市</option>
        {cities.map((c) => (
          <option key={c.city} value={c.city}>
            {c.city}
          </option>
        ))}
      </select>

      <select
        value={district}
        onChange={handleDistrictChange}
        disabled={!city}
        className="w-full px-2 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-100 bg-white disabled:bg-gray-50 disabled:text-gray-400"
      >
        <option value="">选择区县</option>
        {districts.map((d) => (
          <option key={d} value={d}>
            {d}
          </option>
        ))}
      </select>
    </div>
  );
}
