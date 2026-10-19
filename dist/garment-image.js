// Image evidence and ownership are separate: an owned item may have an AI
// reconstruction, which must never be presented as an untouched product photo.
export const isReconstructed=item=>item.provenance?.processingMethod==='ai-reconstruction';
export function validateImageEvidence(item){
  if(isReconstructed(item)&&item.provenance?.review?.reconstructionAuthorized!==true)throw Error('AI 整理图缺少用户授权记录');
  if(item.userConfirmedDetails!==undefined&&(!Array.isArray(item.userConfirmedDetails)||item.userConfirmedDetails.some(t=>typeof t!=='string'||!t.trim()||t.length>300)))throw Error('用户确认信息格式无效');
}
export const imageNotice='根据衣物照片经 AI 重绘并补全遮挡部分；纹理、扣具、缝线和比例可能有偏差，以实物为准。';
