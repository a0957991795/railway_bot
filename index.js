<!DOCTYPE html>
<html lang="ru">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Premium Cleaning</title>

<script src="https://telegram.org/js/telegram-web-app.js"></script>

<style>
body{
font-family:Arial;
background:#f5f5f5;
padding:20px;
margin:0;
}

.card{
background:white;
padding:20px;
border-radius:16px;
margin-bottom:15px;
box-shadow:0 2px 10px rgba(0,0,0,0.08);
}

input, select, textarea{
width:100%;
padding:14px;
margin-top:10px;
border-radius:10px;
border:1px solid #ddd;
box-sizing:border-box;
font-size:16px;
}

button{
width:100%;
padding:16px;
border:none;
border-radius:12px;
background:#28a745;
color:white;
font-size:18px;
margin-top:15px;
cursor:pointer;
font-weight:bold;
}

.price{
font-size:38px;
font-weight:bold;
color:#28a745;
margin-top:15px;
}
</style>
</head>
<body>

<div class="card">
<h1>🧹 Premium Cleaning</h1>

<label>Выберите услугу</label>

<select id="service">
<option value="40">Генеральная уборка</option>
<option value="55">После ремонта</option>
<option value="30">Поддерживающая уборка</option>
<option value="65">Химчистка мебели</option>
</select>

<label>Площадь м²</label>
<input type="number" id="area" placeholder="Например 65">

<div class="price">
~ <span id="total">0</span> грн
</div>
</div>

<div class="card">
<h2>📋 Оформление заявки</h2>

<input id="name" placeholder="Ваше имя">
<input id="phone" placeholder="Телефон">
<input id="address" placeholder="Адрес">
<input id="time" placeholder="Удобное время">
<textarea id="comment" placeholder="Комментарий"></textarea>

<button onclick="sendOrder()">
Отправить заявку
</button>
</div>

<script>

function calculate(){

const area =
Number(document.getElementById('area').value);

const service =
Number(document.getElementById('service').value);

const total = area * service;

document.getElementById('total').innerText = total;

}

document.getElementById('area')
.addEventListener('input', calculate);

document.getElementById('service')
.addEventListener('change', calculate);

async function sendOrder(){

const serviceText =
document.getElementById('service')
.options[
document.getElementById('service').selectedIndex
].text;

const area =
document.getElementById('area').value;

const total =
document.getElementById('total').innerText;

const name =
document.getElementById('name').value;

const phone =
document.getElementById('phone').value;

const address =
document.getElementById('address').value;

const time =
document.getElementById('time').value;

const comment =
document.getElementById('comment').value;

const text = `
🔥 НОВАЯ ЗАЯВКА

🧹 Услуга: ${serviceText}
📐 Площадь: ${area} м²
💰 Стоимость: ${total} грн

👤 Имя: ${name}
📞 Телефон: ${phone}
📍 Адрес: ${address}
⏰ Время: ${time}

💬 Комментарий:
${comment}
`;

const TOKEN = "8587978564:AAEq6QsMJ2UkQp2gwqHtmuEhnitGKLzglfc";
const CHAT_ID = "8822621447";

await fetch(`https://api.telegram.org/bot${TOKEN}/sendMessage`,{
method:"POST",
headers:{
"Content-Type":"application/json"
},
body:JSON.stringify({
chat_id:CHAT_ID,
text:text
})
});

alert("Заявка отправлена!");

}

</script>

</body>
</html>
