'use strict';

const majorZh = [
  '愚者', '魔术师', '女祭司', '皇后', '皇帝', '教皇', '恋人', '战车',
  '力量', '隐者', '命运之轮', '正义', '倒吊人', '死神', '节制', '恶魔',
  '高塔', '星星', '月亮', '太阳', '审判', '世界',
];

const majorThemes = [
  '自由启程、相信可能与保持好奇', '主动创造、调动资源与清晰表达',
  '直觉、沉静观察与未说出口的信息', '滋养、丰盛与让关系自然成长',
  '秩序、边界与承担责任', '传统、承诺与共同价值',
  '选择、吸引与价值观的对齐', '推进、意志与掌握方向',
  '温柔的勇气、耐心与自我调节', '独处反思、寻找内在答案',
  '周期转变、机遇与不可控因素', '公平、因果与诚实衡量',
  '暂停、换位思考与主动放下', '结束旧阶段、蜕变与重新开始',
  '协调、疗愈与寻找中间道路', '执着、诱惑与看见隐性束缚',
  '突变、真相显露与旧结构瓦解', '希望、复原与坦诚做自己',
  '不安、投射与需要核实的直觉', '明朗、活力与彼此看见',
  '觉醒、复盘与回应召唤', '完成、整合与进入新循环',
];

const ranksZh = [
  '王牌', '二', '三', '四', '五', '六', '七', '八', '九', '十',
  '侍从', '骑士', '王后', '国王',
];

const rankThemes = [
  '新的种子与纯粹动力', '权衡、互动与两种可能', '合作、成长与初步成果',
  '稳定、守护与阶段停驻', '摩擦、失落与重新排序',
  '交换、修复与向前过渡', '评估、坚持与策略调整',
  '行动加速、练习与投入', '临近完成、自信与独自承担',
  '累积结果、责任与一个周期的顶点', '学习、消息与新鲜视角',
  '追求、变化与把意图带进行动', '成熟感受、内在掌控与包容',
  '外在掌控、责任与长期判断',
];

const suits = [
  { code: 'wa', zh: '权杖', theme: '行动、热情、创造力与个人意志' },
  { code: 'cu', zh: '圣杯', theme: '情感、关系、直觉与内心需求' },
  { code: 'sw', zh: '宝剑', theme: '思考、沟通、冲突与事实判断' },
  { code: 'pe', zh: '星币', theme: '现实基础、资源、身体感受与长期建设' },
];

const CARD_MAP = {};
const CARD_MEANINGS = {};

majorZh.forEach((nameZh, index) => {
  const id = `ar${String(index).padStart(2, '0')}`;
  CARD_MAP[id] = { nameZh };
  CARD_MEANINGS[id] = {
    upright: `${majorThemes[index]}。在当前问题中，它鼓励看清机会，并以成熟而真实的方式回应。`,
    reversed: `${majorThemes[index]}的能量受阻或走向过度。需要检查逃避、误判或失衡，再决定下一步。`,
  };
});

suits.forEach((suit) => {
  ranksZh.forEach((rank, index) => {
    const id = `${suit.code}${String(index + 1).padStart(2, '0')}`;
    CARD_MAP[id] = { nameZh: `${suit.zh}${rank}` };
    CARD_MEANINGS[id] = {
      upright: `${suit.theme}正在通过“${rankThemes[index]}”显现。留意它在现实中的具体表现。`,
      reversed: `${suit.theme}在“${rankThemes[index]}”上出现延迟、压抑或失衡，需要调整节奏与表达。`,
    };
  });
});

module.exports = { CARD_MAP, CARD_MEANINGS };
