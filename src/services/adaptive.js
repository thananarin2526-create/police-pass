
function chooseDifficulty(accuracy, attempts){
  if(attempts < 5) return 'easy';
  if(accuracy >= 80) return 'medium';
  if(accuracy >= 60) return 'easy';
  return 'easy';
}
function dailyTarget(dayNo){
  if(dayNo<=7) return 25;
  if(dayNo<=21) return 35;
  if(dayNo<=27) return 45;
  return 50;
}
module.exports={chooseDifficulty,dailyTarget};
