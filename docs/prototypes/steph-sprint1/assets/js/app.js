
const menu=document.querySelector('.menu-button'); const links=document.querySelector('.nav-links');
if(menu){menu.addEventListener('click',()=>{const open=links.classList.toggle('open');menu.setAttribute('aria-expanded',open);});}
document.querySelectorAll('.slot:not(:disabled)').forEach(s=>s.addEventListener('click',()=>{document.querySelectorAll('.slot').forEach(x=>x.classList.remove('selected'));s.classList.add('selected');document.querySelector('#selected-time')?.replaceChildren(document.createTextNode(s.textContent.trim()));}));
const filterForm=document.querySelector('#room-filters');if(filterForm){filterForm.addEventListener('submit',e=>{e.preventDefault();document.querySelector('#filter-message').textContent='Prototype filters applied. Connect these controls to your database query in Sprint 2.';});}
