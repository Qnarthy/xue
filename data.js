// Vocabulaire HSK 1 → 3 (ancien format, 600 mots), classé par thème.
// Format : caractères | pinyin (une syllabe par caractère) | sens en français
const RAW = {
1: `
你|nǐ|tu, toi
我|wǒ|je, moi
他|tā|il, lui
她|tā|elle
我们|wǒ men|nous
好|hǎo|bien, bon
是|shì|être
不|bù|ne… pas, non
吗|ma|(particule interrogative)
呢|ne|(particule : « et toi ? »)
谢谢|xiè xie|merci
不客气|bú kè qi|de rien
再见|zài jiàn|au revoir
对不起|duì bu qǐ|pardon, désolé
没关系|méi guān xi|ce n'est pas grave
请|qǐng|s'il vous plaît ; inviter
喂|wèi|allô
叫|jiào|s'appeler ; appeler
名字|míng zi|nom, prénom
什么|shén me|quoi, quel
谁|shéi|qui
哪|nǎ|quel, lequel
哪儿|nǎ r|où
这|zhè|ceci, ce…-ci
那|nà|cela, ce…-là
一|yī|un
二|èr|deux
三|sān|trois
四|sì|quatre
五|wǔ|cinq
六|liù|six
七|qī|sept
八|bā|huit
九|jiǔ|neuf
十|shí|dix
几|jǐ|combien (petit nombre)
多少|duō shao|combien
个|gè|(classificateur général)
本|běn|(classificateur des livres)
些|xiē|quelques
岁|suì|an (âge)
人|rén|personne, être humain
爸爸|bà ba|papa
妈妈|mā ma|maman
儿子|ér zi|fils
女儿|nǚ ér|fille (enfant)
家|jiā|maison, famille
朋友|péng you|ami
老师|lǎo shī|professeur
学生|xué sheng|élève, étudiant
同学|tóng xué|camarade de classe
医生|yī shēng|médecin
先生|xiān sheng|monsieur
小姐|xiǎo jiě|mademoiselle
中国|Zhōng guó|Chine
北京|Běi jīng|Pékin
汉语|Hàn yǔ|chinois (langue)
字|zì|caractère (écrit)
有|yǒu|avoir, il y a
没有|méi yǒu|ne pas avoir
在|zài|être à ; en train de
来|lái|venir
去|qù|aller
回|huí|retourner, rentrer
吃|chī|manger
喝|hē|boire
看|kàn|regarder, lire
看见|kàn jiàn|voir, apercevoir
听|tīng|écouter
说|shuō|parler, dire
读|dú|lire (à voix haute)
写|xiě|écrire
买|mǎi|acheter
做|zuò|faire
坐|zuò|s'asseoir ; prendre (transport)
住|zhù|habiter
开|kāi|ouvrir ; conduire
打电话|dǎ diàn huà|téléphoner
睡觉|shuì jiào|dormir
工作|gōng zuò|travail, travailler
学习|xué xí|étudier, apprendre
认识|rèn shi|connaître (qqn)
喜欢|xǐ huan|aimer, apprécier
爱|ài|aimer (d'amour)
想|xiǎng|vouloir ; penser
会|huì|savoir (faire)
能|néng|pouvoir, être capable
和|hé|et, avec
很|hěn|très
太|tài|trop
都|dōu|tous, tout
的|de|(particule de possession)
了|le|(particule d'action accomplie)
大|dà|grand
小|xiǎo|petit
多|duō|beaucoup, nombreux
少|shǎo|peu
冷|lěng|froid
热|rè|chaud
高兴|gāo xìng|content, heureux
漂亮|piào liang|joli, beau
怎么|zěn me|comment
怎么样|zěn me yàng|comment (ça va) ?
现在|xiàn zài|maintenant
今天|jīn tiān|aujourd'hui
明天|míng tiān|demain
昨天|zuó tiān|hier
上午|shàng wǔ|matin
中午|zhōng wǔ|midi
下午|xià wǔ|après-midi
年|nián|année, an
月|yuè|mois ; lune
号|hào|jour du mois ; numéro
星期|xīng qī|semaine
点|diǎn|heure (pile) ; un peu
分钟|fēn zhōng|minute
时候|shí hou|moment, quand
天气|tiān qì|temps (météo)
下雨|xià yǔ|pleuvoir
上|shàng|sur ; monter
下|xià|sous ; descendre
里|lǐ|dans, intérieur
前面|qián miàn|devant
后面|hòu miàn|derrière
学校|xué xiào|école
商店|shāng diàn|magasin
饭店|fàn diàn|restaurant, hôtel
医院|yī yuàn|hôpital
出租车|chū zū chē|taxi
飞机|fēi jī|avion
钱|qián|argent
块|kuài|yuan (familier) ; morceau
东西|dōng xi|chose, objet
菜|cài|plat ; légume
米饭|mǐ fàn|riz (cuit)
水|shuǐ|eau
茶|chá|thé
水果|shuǐ guǒ|fruit
苹果|píng guǒ|pomme
杯子|bēi zi|tasse, verre
衣服|yī fu|vêtement
书|shū|livre
桌子|zhuō zi|table, bureau
椅子|yǐ zi|chaise
电脑|diàn nǎo|ordinateur
电视|diàn shì|télévision
电影|diàn yǐng|film
猫|māo|chat
狗|gǒu|chien
`,
2: `
您|nín|vous (poli)
它|tā|il, elle (chose, animal)
大家|dà jiā|tout le monde
哥哥|gē ge|grand frère
姐姐|jiě jie|grande sœur
弟弟|dì di|petit frère
妹妹|mèi mei|petite sœur
丈夫|zhàng fu|mari
妻子|qī zi|épouse
孩子|hái zi|enfant
男|nán|homme, masculin
女|nǚ|femme, féminin
服务员|fú wù yuán|serveur
姓|xìng|nom de famille ; s'appeler
介绍|jiè shào|présenter
零|líng|zéro
两|liǎng|deux (quantité)
百|bǎi|cent
千|qiān|mille
第一|dì yī|premier
次|cì|fois
件|jiàn|(classificateur des vêtements)
每|měi|chaque
吧|ba|(particule de suggestion)
早上|zǎo shang|matin (tôt)
晚上|wǎn shang|soir
小时|xiǎo shí|heure (durée)
时间|shí jiān|temps (durée)
去年|qù nián|l'année dernière
日|rì|jour ; soleil
生日|shēng rì|anniversaire
起床|qǐ chuáng|se lever
上班|shàng bān|aller au travail
休息|xiū xi|se reposer
洗|xǐ|laver
穿|chuān|porter (vêtements)
走|zǒu|marcher, partir
跑步|pǎo bù|courir
进|jìn|entrer
出|chū|sortir
到|dào|arriver ; jusqu'à
等|děng|attendre
找|zhǎo|chercher
给|gěi|donner ; pour
送|sòng|offrir ; raccompagner
卖|mài|vendre
问|wèn|demander
告诉|gào su|dire, informer
帮助|bāng zhù|aider
让|ràng|laisser, faire faire
完|wán|finir
玩|wán|jouer, s'amuser
笑|xiào|rire, sourire
说话|shuō huà|parler
唱歌|chàng gē|chanter
跳舞|tiào wǔ|danser
游泳|yóu yǒng|nager
运动|yùn dòng|sport, faire du sport
打篮球|dǎ lán qiú|jouer au basket
踢足球|tī zú qiú|jouer au foot
旅游|lǚ yóu|voyager, tourisme
懂|dǒng|comprendre
知道|zhī dào|savoir
觉得|jué de|trouver, penser
希望|xī wàng|espérer
准备|zhǔn bèi|préparer
开始|kāi shǐ|commencer
要|yào|vouloir ; devoir
可以|kě yǐ|pouvoir (permission)
可能|kě néng|peut-être, possible
生病|shēng bìng|tomber malade
身体|shēn tǐ|corps, santé
眼睛|yǎn jing|œil
药|yào|médicament
考试|kǎo shì|examen
课|kè|cours, leçon
教室|jiào shì|salle de classe
题|tí|question, exercice
问题|wèn tí|question, problème
意思|yì si|sens, signification
铅笔|qiān bǐ|crayon
报纸|bào zhǐ|journal
手机|shǒu jī|téléphone portable
手表|shǒu biǎo|montre
公司|gōng sī|entreprise
宾馆|bīn guǎn|hôtel
房间|fáng jiān|chambre, pièce
门|mén|porte
机场|jī chǎng|aéroport
火车站|huǒ chē zhàn|gare
公共汽车|gōng gòng qì chē|bus
票|piào|billet, ticket
路|lù|route, chemin
旁边|páng biān|à côté
左边|zuǒ bian|à gauche
右边|yòu bian|à droite
外|wài|dehors, extérieur
离|lí|être loin de (distance)
远|yuǎn|loin
近|jìn|proche
往|wǎng|vers
从|cóng|depuis, de
咖啡|kā fēi|café
牛奶|niú nǎi|lait
鸡蛋|jī dàn|œuf
羊肉|yáng ròu|viande de mouton
鱼|yú|poisson
西瓜|xī guā|pastèque
好吃|hǎo chī|délicieux
贵|guì|cher
便宜|pián yi|bon marché
颜色|yán sè|couleur
白|bái|blanc
黑|hēi|noir
红|hóng|rouge
晴|qíng|ensoleillé
阴|yīn|nuageux
雪|xuě|neige
新|xīn|nouveau
长|cháng|long
高|gāo|haut, grand (taille)
快|kuài|rapide
慢|màn|lent
忙|máng|occupé
累|lèi|fatigué
快乐|kuài lè|joyeux, heureux
对|duì|correct ; envers
错|cuò|faux, erreur
真|zhēn|vraiment
非常|fēi cháng|extrêmement
最|zuì|le plus
也|yě|aussi
还|hái|encore ; aussi
再|zài|encore, de nouveau
就|jiù|alors ; justement
已经|yǐ jīng|déjà
一起|yì qǐ|ensemble
一下|yí xià|un peu, un instant
正在|zhèng zài|être en train de
别|bié|ne… pas (impératif)
比|bǐ|comparé à, plus que
因为|yīn wèi|parce que
所以|suǒ yǐ|donc
但是|dàn shì|mais
虽然|suī rán|bien que
为什么|wèi shén me|pourquoi
事情|shì qing|affaire, chose
得|de|(particule de complément)
着|zhe|(particule d'état continu)
过|guo|(particule d'expérience)
`,
3: `
阿姨|ā yí|tante, nounou
叔叔|shū shu|oncle
爷爷|yé ye|grand-père (paternel)
奶奶|nǎi nai|grand-mère (paternelle)
邻居|lín jū|voisin
同事|tóng shì|collègue
经理|jīng lǐ|directeur, manager
校长|xiào zhǎng|directeur d'école
司机|sī jī|chauffeur
客人|kè rén|invité, client
别人|bié rén|les autres
自己|zì jǐ|soi-même
位|wèi|(classificateur poli des personnes)
头发|tóu fa|cheveux
脸|liǎn|visage
鼻子|bí zi|nez
耳朵|ěr duo|oreille
嘴|zuǐ|bouche
口|kǒu|bouche ; ouverture
腿|tuǐ|jambe
脚|jiǎo|pied
个子|gè zi|taille (corps)
矮|ǎi|petit (taille)
胖|pàng|gros
瘦|shòu|mince
年轻|nián qīng|jeune
老|lǎo|vieux
可爱|kě ài|mignon
聪明|cōng ming|intelligent
健康|jiàn kāng|santé ; en bonne santé
感冒|gǎn mào|rhume
发烧|fā shāo|avoir de la fièvre
疼|téng|avoir mal
舒服|shū fu|confortable, à l'aise
饿|è|avoir faim
渴|kě|avoir soif
饱|bǎo|rassasié
锻炼|duàn liàn|s'entraîner
爬山|pá shān|randonnée en montagne
比赛|bǐ sài|compétition, match
体育|tǐ yù|sport (éducation physique)
爱好|ài hào|loisir, passion
游戏|yóu xì|jeu
音乐|yīn yuè|musique
画|huà|dessiner ; tableau
故事|gù shi|histoire, conte
节目|jié mù|programme, émission
新闻|xīn wén|actualités
上网|shàng wǎng|aller sur Internet
电子邮件|diàn zǐ yóu jiàn|e-mail
照片|zhào piàn|photo
照相机|zhào xiàng jī|appareil photo
菜单|cài dān|menu
面包|miàn bāo|pain
面条|miàn tiáo|nouilles
蛋糕|dàn gāo|gâteau
香蕉|xiāng jiāo|banane
果汁|guǒ zhī|jus de fruit
饮料|yǐn liào|boisson
啤酒|pí jiǔ|bière
甜|tián|sucré
新鲜|xīn xiān|frais
筷子|kuài zi|baguettes
碗|wǎn|bol
盘子|pán zi|assiette
瓶子|píng zi|bouteille
冰箱|bīng xiāng|réfrigérateur
空调|kōng tiáo|climatisation
厨房|chú fáng|cuisine (pièce)
洗手间|xǐ shǒu jiān|toilettes
洗澡|xǐ zǎo|se doucher, se laver
刷牙|shuā yá|se brosser les dents
灯|dēng|lampe
楼|lóu|immeuble ; étage
层|céng|étage
电梯|diàn tī|ascenseur
搬|bān|déménager ; porter
打扫|dǎ sǎo|nettoyer
干净|gān jìng|propre
衬衫|chèn shān|chemise
裤子|kù zi|pantalon
裙子|qún zi|jupe
帽子|mào zi|chapeau
皮鞋|pí xié|chaussures en cuir
伞|sǎn|parapluie
双|shuāng|paire
条|tiáo|(classificateur des objets longs)
张|zhāng|(classificateur des objets plats)
辆|liàng|(classificateur des véhicules)
种|zhǒng|sorte, type
段|duàn|segment, passage
超市|chāo shì|supermarché
银行|yín háng|banque
信用卡|xìn yòng kǎ|carte de crédit
元|yuán|yuan
角|jiǎo|10 centimes ; coin, angle
分|fēn|centime ; point ; diviser
一共|yí gòng|au total
花|huā|fleur ; dépenser
换|huàn|changer, échanger
还|huán|rendre
借|jiè|emprunter, prêter
礼物|lǐ wù|cadeau
护照|hù zhào|passeport
行李箱|xíng li xiāng|valise
地铁|dì tiě|métro
船|chuán|bateau
自行车|zì xíng chē|vélo
骑|qí|monter (vélo, cheval)
起飞|qǐ fēi|décoller
站|zhàn|station ; être debout
地图|dì tú|carte (géographique)
街道|jiē dào|rue
附近|fù jìn|à proximité
地方|dì fang|endroit
城市|chéng shì|ville
国家|guó jiā|pays
世界|shì jiè|monde
公园|gōng yuán|parc
图书馆|tú shū guǎn|bibliothèque
办公室|bàn gōng shì|bureau (pièce)
东|dōng|est
西|xī|ouest
南|nán|sud
北方|běi fāng|le nord
中间|zhōng jiān|milieu
一直|yì zhí|tout droit ; toujours
向|xiàng|vers
经过|jīng guò|passer par
离开|lí kāi|quitter
春|chūn|printemps
夏|xià|été
秋|qiū|automne
冬|dōng|hiver
季节|jì jié|saison
刮风|guā fēng|il y a du vent
云|yún|nuage
太阳|tài yáng|soleil
月亮|yuè liang|lune
树|shù|arbre
草|cǎo|herbe
河|hé|rivière
黄河|Huáng hé|fleuve Jaune
动物|dòng wù|animal
熊猫|xióng māo|panda
鸟|niǎo|oiseau
马|mǎ|cheval
只|zhī|(classificateur des animaux)
环境|huán jìng|environnement
蓝|lán|bleu
绿|lǜ|vert
周末|zhōu mò|week-end
刻|kè|quart d'heure
半|bàn|moitié, demi
刚才|gāng cái|tout à l'heure
以前|yǐ qián|avant, autrefois
后来|hòu lái|plus tard, ensuite
最近|zuì jìn|récemment
过去|guò qù|le passé ; passer
马上|mǎ shàng|tout de suite
一会儿|yí huì r|un moment
久|jiǔ|longtemps
迟到|chí dào|être en retard
节日|jié rì|fête
会议|huì yì|réunion
举行|jǔ xíng|organiser (événement)
参加|cān jiā|participer
见面|jiàn miàn|se rencontrer
聊天|liáo tiān|bavarder
结婚|jié hūn|se marier
欢迎|huān yíng|bienvenue ; accueillir
照顾|zhào gù|s'occuper de
关心|guān xīn|se soucier de
帮忙|bāng máng|aider, rendre service
带|dài|apporter, emmener
接|jiē|aller chercher ; recevoir
拿|ná|prendre, tenir
放|fàng|mettre, poser
关|guān|fermer, éteindre
发|fā|envoyer
用|yòng|utiliser
试|shì|essayer
讲|jiǎng|expliquer, raconter
教|jiāo|enseigner
复习|fù xí|réviser
练习|liàn xí|s'exercer ; exercice
作业|zuò yè|devoirs
成绩|chéng jì|résultat, note
年级|nián jí|année scolaire
班|bān|classe
黑板|hēi bǎn|tableau noir
词典|cí diǎn|dictionnaire
笔记本|bǐ jì běn|carnet ; ordinateur portable
句子|jù zi|phrase
中文|Zhōng wén|chinois (langue)
普通话|pǔ tōng huà|mandarin standard
数学|shù xué|mathématiques
历史|lì shǐ|histoire (passé)
文化|wén huà|culture
留学|liú xué|étudier à l'étranger
水平|shuǐ píng|niveau
提高|tí gāo|améliorer
努力|nǔ lì|faire des efforts
认真|rèn zhēn|sérieux, consciencieux
简单|jiǎn dān|simple
容易|róng yì|facile
难|nán|difficile
清楚|qīng chu|clair
明白|míng bai|comprendre ; clair
了解|liǎo jiě|connaître, comprendre
记得|jì de|se souvenir
忘记|wàng jì|oublier
发现|fā xiàn|découvrir
相信|xiāng xìn|croire, faire confiance
认为|rèn wéi|penser, estimer
决定|jué dìng|décider
打算|dǎ suàn|compter (faire) ; projet
选择|xuǎn zé|choisir
同意|tóng yì|être d'accord
愿意|yuàn yì|vouloir bien
需要|xū yào|avoir besoin
要求|yāo qiú|exiger ; exigence
应该|yīng gāi|devoir (il faut)
必须|bì xū|devoir absolument
解决|jiě jué|résoudre
完成|wán chéng|achever
结束|jié shù|finir, terminer
检查|jiǎn chá|vérifier ; examen
回答|huí dá|répondre
办法|bàn fǎ|moyen, solution
机会|jī huì|occasion, chance
关系|guān xi|relation
变化|biàn huà|changement
影响|yǐng xiǎng|influence ; influencer
习惯|xí guàn|habitude
遇到|yù dào|rencontrer (par hasard)
请假|qǐng jià|demander un congé
担心|dān xīn|s'inquiéter
害怕|hài pà|avoir peur
生气|shēng qì|se fâcher
难过|nán guò|triste
着急|zháo jí|s'inquiéter, être pressé
满意|mǎn yì|satisfait
放心|fàng xīn|être rassuré
感兴趣|gǎn xìng qù|s'intéresser à
热情|rè qíng|chaleureux
奇怪|qí guài|étrange
哭|kū|pleurer
声音|shēng yīn|son, voix
安静|ān jìng|calme
方便|fāng biàn|pratique
重要|zhòng yào|important
特别|tè bié|particulièrement
主要|zhǔ yào|principal
一般|yì bān|général, ordinaire
一样|yí yàng|pareil
其他|qí tā|autre
旧|jiù|vieux, usé
坏|huài|mauvais ; cassé
短|duǎn|court
低|dī|bas
有名|yǒu míng|célèbre
差|chà|manquer ; mauvais
极|jí|extrêmement
多么|duō me|comme… ! (exclamatif)
更|gèng|encore plus
比较|bǐ jiào|assez ; comparer
几乎|jī hū|presque
终于|zhōng yú|finalement
突然|tū rán|soudain
一定|yí dìng|certainement
总是|zǒng shì|toujours
经常|jīng cháng|souvent
又|yòu|de nouveau
才|cái|seulement alors
只|zhǐ|seulement
先|xiān|d'abord
然后|rán hòu|ensuite
最后|zuì hòu|enfin ; dernier
一边|yì biān|en même temps
越|yuè|plus… plus
还是|hái shi|ou (question) ; toujours
或者|huò zhě|ou (bien)
如果|rú guǒ|si
不但|bú dàn|non seulement
而且|ér qiě|de plus
除了|chú le|à part, excepté
根据|gēn jù|selon, d'après
关于|guān yú|au sujet de
为了|wèi le|afin de
为|wèi|pour
跟|gēn|avec ; suivre
把|bǎ|(particule d'objet)
被|bèi|(marque du passif)
地|de|(particule adverbiale)
啊|a|(particule exclamative)
像|xiàng|ressembler
遍|biàn|fois (du début à la fin)
万|wàn|dix mille
公斤|gōng jīn|kilogramme
米|mǐ|mètre
`
};

export const WORDS = [];
for (const lvl of [1, 2, 3]) {
  RAW[lvl].trim().split('\n').forEach((line, i) => {
    const [h, p, f] = line.split('|');
    if (!h) return;
    WORDS.push({ id: h + '_' + p.replace(/\s/g, ''), h, p, f, lvl, ord: lvl * 1000 + i });
  });
}
export const WORD_BY_ID = Object.fromEntries(WORDS.map(w => [w.id, w]));
