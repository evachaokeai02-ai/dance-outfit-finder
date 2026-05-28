export const danceTypeOptions = ['K-pop', 'Jazz', '路演', '练舞房', 'Urban', '女团', '其他'];
export const styleOptions = ['甜酷', '辣妹', '清冷', '运动', 'Y2K', '学院', '暗黑', '元气', '性感', '甜辣', '妈咪'];
export const sceneOptions = ['练舞房', '户外', '舞台', '路演', '夜景'];
export const budgetOptions = ['50-100', '100-200', '200-300'];
export const bodyOptions = ['显腿长', '显腰', '遮胯', '不露腰', '方便大动作'];

export const visualMap = {
  'pink-mint': 'linear-gradient(135deg, #fecdd3 0%, #fbcfe8 42%, #99f6e4 100%)',
  'mint-lemon': 'linear-gradient(135deg, #99f6e4 0%, #ecfccb 48%, #fde68a 100%)',
  'ice-lilac': 'linear-gradient(135deg, #dbeafe 0%, #ddd6fe 55%, #f5f3ff 100%)',
  'rose-black': 'linear-gradient(135deg, #fb7185 0%, #7f1d1d 48%, #111827 100%)',
  'cream-blue': 'linear-gradient(135deg, #fff7ed 0%, #bfdbfe 52%, #fef3c7 100%)',
  'black-silver': 'linear-gradient(135deg, #111827 0%, #64748b 50%, #e5e7eb 100%)',
  'blue-yellow': 'linear-gradient(135deg, #bfdbfe 0%, #38bdf8 46%, #fde68a 100%)',
  'silver-cyan': 'linear-gradient(135deg, #e5e7eb 0%, #a5f3fc 48%, #475569 100%)',
};

export const lookConfigs = [
  {
    key: 'stage',
    title: '打歌服灵感版',
    label: '还原感最高',
    extraScenes: ['舞台'],
    extraStyles: ['甜酷'],
    tone: '把舞台关键词落到日常能穿的单品上，重点保留比例、亮点和气场。',
    reasonPrefix: '这套更贴近原舞台的记忆点，',
    photoTip: '适合用低机位半身到全身切换，卡点时让配饰和上衣细节进入画面。',
  },
  {
    key: 'roadshow',
    title: '普通人路演版',
    label: '稳、舒服、能跳',
    extraScenes: ['路演', '户外'],
    extraStyles: ['运动'],
    extraBody: ['方便大动作'],
    tone: '把安全感和活动量放在前面，适合户外、商场中庭或临时路演。',
    reasonPrefix: '这套更适合长时间跳和走位，',
    photoTip: '建议选干净背景，侧身起手和定点 Pose 都容易显腿长。',
  },
  {
    key: 'daily',
    title: '日常出片版',
    label: '好拍又不夸张',
    extraScenes: ['日常', '户外'],
    extraStyles: ['学院', '元气'],
    tone: '降低舞台浓度，保留风格氛围，拍视频和日常穿出门都自然。',
    reasonPrefix: '这套更像小红书出片穿搭，',
    photoTip: '适合用自然光，抓转身、抬手、回头，画面会更轻松。',
  },
];
