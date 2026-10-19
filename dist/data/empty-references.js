// Generic empty library; private editorial data is projected by the server.
export default {
  schemaVersion:1,codeRegistry:{},formulas:[],
  seasons:[['winter','冬天'],['autumn','秋冬'],['transition','春秋'],['summer','夏天']].map(([id,name])=>({id,name,english:id.toUpperCase(),mood:'从自己的衣橱开始',intro:'还没有穿搭参考。',range:'按完整造型归档',formulaIds:[],weather:[],principles:[],note:''}))
};
