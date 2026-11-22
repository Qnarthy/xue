// Phrases utiles du quotidien (voyage, rencontres, restaurant…).
// Format : mots en caractères séparés par des espaces | pinyin de chaque mot | traduction
// « ， » marque une virgule. Le pinyin note les changements de ton de 一 et 不 (bú shì, yí cì).
import { WORDS } from './data.js';
import { splitPinyin } from './pinyin.js';

const RAW = `
你 好|nǐ hǎo|Bonjour !
你 好 吗|nǐ hǎo ma|Comment vas-tu ?
我 很 好 ， 谢谢|wǒ hěn hǎo , xièxie|Je vais bien, merci.
你 呢|nǐ ne|Et toi ?
我 也 是|wǒ yě shì|Moi aussi.
你 叫 什么 名字|nǐ jiào shénme míngzi|Comment tu t'appelles ?
认识 你 很 高兴|rènshi nǐ hěn gāoxìng|Enchanté de te connaître.
我 是 学生|wǒ shì xuésheng|Je suis étudiant.
我 是 法国人|wǒ shì Fǎguórén|Je suis français.
你 是 哪 国 人|nǐ shì nǎ guó rén|Tu viens de quel pays ?
他 是 我 的 朋友|tā shì wǒ de péngyou|C'est mon ami.
我们 是 好 朋友|wǒmen shì hǎo péngyou|Nous sommes bons amis.
我们 都 是 学生|wǒmen dōu shì xuésheng|Nous sommes tous étudiants.
你 多 大|nǐ duō dà|Quel âge as-tu ?
你 家 有 几 个 人|nǐ jiā yǒu jǐ gè rén|Vous êtes combien dans ta famille ?
我 爱 你|wǒ ài nǐ|Je t'aime.
谢谢 你|xièxie nǐ|Merci à toi.
对不起 ， 我 来 晚 了|duìbuqǐ , wǒ lái wǎn le|Désolé, je suis en retard.
没关系|méiguānxi|Ce n'est pas grave.
明天 见|míngtiān jiàn|À demain !
这 是 什么|zhè shì shénme|Qu'est-ce que c'est ?
那 是 我 的 书|nà shì wǒ de shū|Ça, c'est mon livre.
这 个 多少 钱|zhè ge duōshao qián|Combien coûte celui-ci ?
太 贵 了|tài guì le|C'est trop cher !
我 要 这 个|wǒ yào zhè ge|Je veux celui-ci.
我 想 喝 茶|wǒ xiǎng hē chá|Je voudrais boire du thé.
我 要 一 杯 水|wǒ yào yì bēi shuǐ|Je voudrais un verre d'eau.
你 想 吃 什么|nǐ xiǎng chī shénme|Qu'est-ce que tu veux manger ?
我 喜欢 吃 中国 菜|wǒ xǐhuan chī Zhōngguó cài|J'aime la cuisine chinoise.
我 不 吃 肉|wǒ bù chī ròu|Je ne mange pas de viande.
很 好吃|hěn hǎochī|C'est délicieux !
你 吃 饭 了 吗|nǐ chī fàn le ma|Tu as mangé ? (salutation courante)
我 饿 了|wǒ è le|J'ai faim.
你 住 在 哪儿|nǐ zhù zài nǎr|Où habites-tu ?
我 住 在 北京|wǒ zhù zài Běijīng|J'habite à Pékin.
洗手间 在 哪儿|xǐshǒujiān zài nǎr|Où sont les toilettes ?
商店 在 哪儿|shāngdiàn zài nǎr|Où est le magasin ?
我 想 去 北京|wǒ xiǎng qù Běijīng|Je voudrais aller à Pékin.
你 想 去 哪儿|nǐ xiǎng qù nǎr|Où veux-tu aller ?
我 坐 出租车 去|wǒ zuò chūzūchē qù|J'y vais en taxi.
我 坐 飞机 回 家|wǒ zuò fēijī huí jiā|Je rentre chez moi en avion.
你 什么 时候 回 家|nǐ shénme shíhou huí jiā|Quand rentres-tu à la maison ?
现在 几 点|xiànzài jǐ diǎn|Quelle heure est-il ?
现在 三 点|xiànzài sān diǎn|Il est trois heures.
今天 星期 几|jīntiān xīngqī jǐ|On est quel jour aujourd'hui ?
今天 天气 怎么样|jīntiān tiānqì zěnmeyàng|Quel temps fait-il aujourd'hui ?
今天 很 热|jīntiān hěn rè|Il fait très chaud aujourd'hui.
今天 太 冷 了|jīntiān tài lěng le|Il fait trop froid aujourd'hui !
明天 会 下雨|míngtiān huì xiàyǔ|Il va pleuvoir demain.
我 会 说 一点儿 汉语|wǒ huì shuō yìdiǎnr Hànyǔ|Je parle un peu chinois.
我 不 会 说 汉语|wǒ bú huì shuō Hànyǔ|Je ne parle pas chinois.
我 在 学习 汉语|wǒ zài xuéxí Hànyǔ|J'apprends le chinois.
你 的 汉语 很 好|nǐ de Hànyǔ hěn hǎo|Ton chinois est très bon.
哪里 哪里|nǎli nǎli|Oh, pas du tout ! (réponse modeste)
我 听 不 懂|wǒ tīng bu dǒng|Je ne comprends pas (à l'oral).
请 再 说 一 次|qǐng zài shuō yí cì|Tu peux répéter, s'il te plaît ?
请 说 慢 一点儿|qǐng shuō màn yìdiǎnr|Parle plus lentement, s'il te plaît.
用 汉语 怎么 说|yòng Hànyǔ zěnme shuō|Comment on dit ça en chinois ?
你 在 做 什么|nǐ zài zuò shénme|Qu'est-ce que tu fais ?
我 在 看 书|wǒ zài kàn shū|Je suis en train de lire.
你 喜欢 做 什么|nǐ xǐhuan zuò shénme|Qu'est-ce que tu aimes faire ?
我 喜欢 看 电影|wǒ xǐhuan kàn diànyǐng|J'aime regarder des films.
你 是 做 什么 工作 的|nǐ shì zuò shénme gōngzuò de|Qu'est-ce que tu fais comme travail ?
我 是 医生|wǒ shì yīshēng|Je suis médecin.
我 有 一 只 猫|wǒ yǒu yì zhī māo|J'ai un chat.
我 想 买 东西|wǒ xiǎng mǎi dōngxi|Je voudrais faire des achats.
我 下午 去 商店|wǒ xiàwǔ qù shāngdiàn|Cet après-midi, je vais au magasin.
这 家 饭店 的 菜 很 好吃|zhè jiā fàndiàn de cài hěn hǎochī|La cuisine de ce restaurant est délicieuse.
他 在 打电话|tā zài dǎdiànhuà|Il est au téléphone.
你 有 微信 吗|nǐ yǒu Wēixìn ma|Tu as WeChat ?
我 能 坐 这儿 吗|wǒ néng zuò zhèr ma|Je peux m'asseoir ici ?
我 不 知道|wǒ bù zhīdào|Je ne sais pas.
这 是 什么 意思|zhè shì shénme yìsi|Qu'est-ce que ça veut dire ?
我们 一起 去 吧|wǒmen yìqǐ qù ba|Allons-y ensemble !
你 等 一下|nǐ děng yíxià|Attends un instant.
我 在 等 你|wǒ zài děng nǐ|Je t'attends.
我 累 了|wǒ lèi le|Je suis fatigué.
我 身体 不 舒服|wǒ shēntǐ bù shūfu|Je ne me sens pas bien.
我 要 去 医院|wǒ yào qù yīyuàn|Je dois aller à l'hôpital.
便宜 一点儿 吧|piányi yìdiǎnr ba|Un peu moins cher, s'il vous plaît !
有 没有 小 一点儿 的|yǒu méiyǒu xiǎo yìdiǎnr de|Vous en avez un plus petit ?
我 只 是 看看|wǒ zhǐ shì kànkan|Je regarde seulement.
我 想 买 一 件 衣服|wǒ xiǎng mǎi yí jiàn yīfu|Je voudrais acheter un vêtement.
你 喜欢 什么 颜色|nǐ xǐhuan shénme yánsè|Quelle couleur aimes-tu ?
服务员 ， 买单|fúwùyuán , mǎidān|Serveur, l'addition s'il vous plaît !
我 可以 用 手机 付 钱 吗|wǒ kěyǐ yòng shǒujī fù qián ma|Je peux payer avec mon téléphone ?
苹果 一 斤 多少 钱|píngguǒ yì jīn duōshao qián|Combien coûte le demi-kilo de pommes ?
火车站 在 哪儿|huǒchēzhàn zài nǎr|Où est la gare ?
离 这儿 远 吗|lí zhèr yuǎn ma|C'est loin d'ici ?
不 远 ， 很 近|bù yuǎn , hěn jìn|Ce n'est pas loin, c'est tout près.
往 前 走|wǎng qián zǒu|Va tout droit.
在 左边|zài zuǒbian|C'est à gauche.
在 右边|zài yòubian|C'est à droite.
我 去 机场|wǒ qù jīchǎng|Je vais à l'aéroport.
一 张 票 多少 钱|yì zhāng piào duōshao qián|Combien coûte un billet ?
你们 有 房间 吗|nǐmen yǒu fángjiān ma|Vous avez une chambre ?
我 要 住 两 天|wǒ yào zhù liǎng tiān|Je reste deux nuits.
我 是 来 旅游 的|wǒ shì lái lǚyóu de|Je suis venu en touriste.
我 第一 次 来 中国|wǒ dìyī cì lái Zhōngguó|C'est la première fois que je viens en Chine.
我 从 法国 来|wǒ cóng Fǎguó lái|Je viens de France.
你 去 过 中国 吗|nǐ qù guo Zhōngguó ma|Tu es déjà allé en Chine ?
坐 飞机 要 十 个 小时|zuò fēijī yào shí gè xiǎoshí|En avion, il faut dix heures.
我 找 不 到 我 的 手机|wǒ zhǎo bu dào wǒ de shǒujī|Je ne trouve pas mon téléphone.
你 能 帮助 我 吗|nǐ néng bāngzhù wǒ ma|Tu peux m'aider ?
我 觉得 很 好|wǒ juéde hěn hǎo|Je trouve ça très bien.
我 已经 吃 了|wǒ yǐjīng chī le|J'ai déjà mangé.
我 没有 时间|wǒ méiyǒu shíjiān|Je n'ai pas le temps.
我 明天 要 上班|wǒ míngtiān yào shàngbān|Demain, je dois travailler.
你 每 天 几 点 起床|nǐ měi tiān jǐ diǎn qǐchuáng|À quelle heure tu te lèves chaque jour ?
我 七 点 起床|wǒ qī diǎn qǐchuáng|Je me lève à sept heures.
你 最近 忙 吗|nǐ zuìjìn máng ma|Tu es occupé en ce moment ?
因为 下雨 ， 所以 我 不 去|yīnwèi xiàyǔ , suǒyǐ wǒ bú qù|Comme il pleut, je n'y vais pas.
他 比 我 高|tā bǐ wǒ gāo|Il est plus grand que moi.
这 本 书 很 有 意思|zhè běn shū hěn yǒu yìsi|Ce livre est très intéressant.
祝 你 生日 快乐|zhù nǐ shēngrì kuàilè|Joyeux anniversaire !
`;

// Sens des mots qui ne sont pas dans la liste HSK (pour la traduction mot à mot)
export const EXTRA = {
  '法国人': 'Français(e)', '国': 'pays', '晚': 'tard', '肉': 'viande', '饭': 'repas, riz', '饿': 'avoir faim',
  '洗手间': 'toilettes', '只': '(classificateur des animaux) ; seulement', '微信': 'WeChat', '这儿': 'ici',
  '舒服': 'confortable, bien', '看看': 'jeter un œil', '买单': "l'addition", '用': 'utiliser', '付': 'payer',
  '斤': 'demi-kilo (unité)', '张': '(classificateur des objets plats)', '你们': 'vous', '法国': 'France',
  '最近': 'ces derniers temps', '祝': 'souhaiter', '前': 'devant', '哪里': 'où ; (modestie) pas du tout',
  '一点儿': 'un peu', '杯': 'verre, tasse', '家': 'famille, maison ; (classificateur des restaurants)',
  '到': 'arriver ; (résultat) réussir à', '帮助': 'aider', '天': 'jour', '见': 'voir ; (à demain) se revoir',
};

const BY_H = {};
for (const w of WORDS) if (!BY_H[w.h]) BY_H[w.h] = w;
// un vocabulaire HSK plus long (ex. 杯子) peut aider pour 杯 : on cherche juste l'égalité exacte ici

export const SENTENCES = RAW.trim().split('\n').map((line, i) => {
  const [hz, py, fr] = line.split('|');
  const hs = hz.trim().split(/\s+/), ps = py.trim().split(/\s+/);
  if (hs.length !== ps.length) console.warn('Phrase mal alignée :', line);
  const toks = hs.map((h, k) => {
    const punct = h === '，';
    const w = punct ? null : BY_H[h] || null;
    // pinyin découpé en syllabes (pour colorer chaque ton) ; 儿 final se fond dans la syllabe d'avant
    const n = [...h].filter(c => c !== '儿' || !/r$/i.test(ps[k])).length;
    const er = n < [...h].length; // 一点儿 : on découpe « yìdiǎn » puis on recolle le r
    const sp = punct ? null : er ? splitPinyin(ps[k].slice(0, -1), n) : splitPinyin(ps[k], n);
    const syl = sp ? sp + (er ? 'r' : '') : ps[k];
    return { h, p: syl, punct, wid: w ? w.id : null, f: w ? w.f : EXTRA[h] || '' };
  });
  const vocab = toks.filter(t => t.wid);
  const ord = vocab.length ? Math.max(...vocab.map(t => BY_H[t.h].ord)) : 1500;
  const lvl = vocab.length ? Math.max(...vocab.map(t => BY_H[t.h].lvl)) : 1;
  const end = /\?\s*(\(.*\))?$/.test(fr) ? '？' : /!\s*(\(.*\))?$/.test(fr) ? '！' : '。';
  return { id: 's_' + hs.join(''), toks, fr: fr.trim(), ord, lvl, end,
    hz: hs.join('') + end, text: hs.join('') };
});
export const SENT_BY_ID = Object.fromEntries(SENTENCES.map(s => [s.id, s]));
