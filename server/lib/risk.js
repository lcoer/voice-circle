'use strict';
/** 轻量风控词表：用于发布内容自动扫描，命中强风险词的内容进入人工审核队列。 */

const STRONG = [
  '内部渠道', '包过审核', '包审核', '月入过万', '日入过万', '稳赚',
  '代结算', '代入驻', '免考核', '保底包证'
];

const WEAK = ['保证金', '培训费', '名额有限', '加微信先付', '先交', '名额将至'];

function scan(text) {
  const raw = String(text || '');
  const hits = STRONG.filter((w) => raw.includes(w));
  const weakHits = WEAK.filter((w) => raw.includes(w));
  return {
    hits,
    weakHits,
    level: hits.length > 0 ? 'high' : weakHits.length >= 2 ? 'medium' : 'none'
  };
}

/** 薪资虚高粗判：招聘类除分成岗外，月薪上限超过阈值且时长要求过低时提示人工复核 */
function salaryLooksOdd(job) {
  if (!job.salary_max) return false;
  return job.salary_unit === '元/月' && job.salary_max >= 20000;
}

module.exports = { STRONG, WEAK, scan, salaryLooksOdd };
