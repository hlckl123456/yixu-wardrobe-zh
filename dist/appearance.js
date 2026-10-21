// Appearance is a browser preference, separate from wardrobe records and imports.
(() => {
 const key='yixu:appearance:v1',themes=['sand','rose','blue','sage'];
 const valid=value=>themes.includes(value)?value:'sand';
 let selected='sand';
 try{selected=valid(localStorage.getItem(key));}catch{}
 document.documentElement.dataset.theme=selected;
 document.addEventListener('DOMContentLoaded',()=>{
  const picker=document.querySelector('.theme-picker');
  if(!picker)return;
  const summary=picker.querySelector('summary');
  function apply(theme){
   selected=valid(theme);document.documentElement.dataset.theme=selected;
   for(const button of picker.querySelectorAll('[data-theme-choice]'))button.setAttribute('aria-pressed',String(button.dataset.themeChoice===selected));
  }
  apply(selected);
  picker.addEventListener('click',event=>{
   const button=event.target.closest('[data-theme-choice]');if(!button)return;
   apply(button.dataset.themeChoice);
   try{localStorage.setItem(key,selected);}catch{}
  });
  document.addEventListener('click',event=>{if(!picker.contains(event.target))picker.open=false;});
  document.addEventListener('keydown',event=>{if(event.key==='Escape'&&picker.open){picker.open=false;summary.focus();event.preventDefault();}});
  window.addEventListener('storage',event=>{if(event.key===key)apply(event.newValue);});
 });
})();
