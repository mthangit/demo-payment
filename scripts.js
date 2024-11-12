// Constants
const payment_api = "https://backend-demo-payment.onrender.com/api/payment";
const retrieve_api = "https://backend-demo-payment.onrender.com/api/payment-info";

// Global variables
let paymentMethodSelected = '';

// Payment method selection
function selectPaymentMethod(method) {
	const backButton = document.getElementById('resetButton');
	backButton.style.display = 'block';

	const paymentMethods = document.querySelectorAll('.payment-method');
	paymentMethods.forEach(methodElement => methodElement.classList.remove('selected'));

	const selectedMethod = document.querySelector(`.payment-method[onclick="selectPaymentMethod('${method}')"]`);
	if (selectedMethod) {
		selectedMethod.classList.add('selected');
	}

	paymentMethodSelected = method;
}

// Reset functionality
function goBack() {
	const paymentView = document.getElementById('paymentView');
	const backButton = document.getElementById('resetButton');

	backButton.style.display = 'none';
	paymentView.innerHTML = 'Chọn phương thức thanh toán để xem giao diện';

	const paymentMethods = document.querySelectorAll('.payment-method');
	paymentMethods.forEach(methodElement => methodElement.classList.remove('selected'));
}

// Main payment processing function
async function updatePaymentInfo() {
	const selectElement = document.getElementById('product-select');
	const selectedOption = selectElement.options[selectElement.selectedIndex];
	const amount = selectedOption.getAttribute('data-price');
	const productID = selectedOption.value;
	const content = document.getElementById('content').value;
	const paymentView = document.getElementById('paymentView');

	console.log('Amount:', amount);
	console.log('Content:', content);
	console.log('Payment Method:', paymentMethodSelected);

	if (!amount || !paymentMethodSelected) {
		alert('Vui lòng điền đầy đủ số tiền và chọn phương thức thanh toán!');
		return;
	}

	try {
		const response = await fetch(payment_api, {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
			},
			body: JSON.stringify({
				amount: parseInt(amount),
				description: content,
				payment_method: paymentMethodSelected,
				product_id: productID
			})
		});

		const data = await response.json();
		console.log('Data:', data);

		if (data.status === 'success') {
			if (data.method === 'qr_code') {
				paymentView.innerHTML = `
                    <div style="text-align: center;">
                        <h3>Quét mã QR để thanh toán</h3>
                        <img src="${data.url}" alt="Mã QR Ngân hàng" class="qr-image">
                    </div>
                `;
			} else {
				await handlePaymentPopup(data);
			}
		} else {
			alert('Cập nhật thất bại, vui lòng thử lại!');
			console.error('Cập nhật thất bại:', data.message);
		}
	} catch (error) {
		console.error('Có lỗi xảy ra:', error);
		alert('Có lỗi xảy ra, vui lòng thử lại!');
	}
}

// Handle payment popup
async function handlePaymentPopup(data) {
	const popup = window.open(data.url, '_blank', 'width=800,height=600,scrollbars=yes');

	return new Promise((resolve) => {
		// Listen for messages from popup
		window.addEventListener('message', async function (event) {
			if (event.data && event.data.type === 'url_change' && event.data.url) {
				const returnUrl = event.data.url;
				let paymentData;

				if (data.method === 'stripe') {
					const session_id = data.session_id;
					paymentData = await fetchPaymentData(session_id);
				} else {
					const urlParams = getParamsFromUrl(returnUrl);
					paymentData = parsePaymentData(data.method, urlParams);
				}

				updatePaymentView(paymentData);
				popup.close();
				resolve();
			}
		});

		// Check if popup is closed
		const checkPopupClosed = setInterval(() => {
			if (popup.closed) {
				clearInterval(checkPopupClosed);
				resolve();
			}
		}, 1000);
	});
}

// Fetch payment data from API
async function fetchPaymentData(session_id) {
	const response = await fetch(`${retrieve_api}?session_id=${session_id}`, {
		method: 'GET',
		headers: {
			'Content-Type': 'application/json',
		},
	});
	return await response.json();
}

// Parse payment data based on method
function parsePaymentData(method, urlParams) {
	if (method === 'momo') {
		return {
			amount: parseInt(urlParams['amount']),
			method: 'Momo',
			description: urlParams['orderInfo'],
			timestampt: urlParams['responseTime']
		};
	} else if (method === 'vnpay') {
		return {
			amount: parseInt(urlParams['vnp_Amount']) / 100,
			method: 'VNPay',
			description: urlParams['vnp_OrderInfo'],
			timestampt: urlParams['vnp_PayDate']
		};
	}
	return null;
}

// Update payment view
function updatePaymentView(data) {
	const paymentView = document.getElementById('paymentView');
	const amountPayment = data.amount;
	let paymentMethod = data.method;
	const paymentInfo = data.description;
	let timePayment = convertTimestampToDateGMT7(data.timestampt);

	console.log('Data:', data);

	if (data.method === 'stripe') {
		paymentMethod = data.payment_method_type
	} else if (data.method === 'VNPay') {
		timePayment = convertToLocalDateString(data.timestampt);
	}

	fetch('payment_success.html')
		.then(response => response.text())
		.then(htmlContent => {
			htmlContent = htmlContent.replace('{{payment-amount}}', amountPayment)
				.replace('{{payment-method}}', paymentMethod)
				.replace('{{payment-info}}', paymentInfo)
				.replace('{{payment-time}}', timePayment);

			paymentView.innerHTML = htmlContent;
		})
		.catch(error => {
			console.error('Lỗi tải trang thanh toán thành công:', error);
		});
}

// Utility functions
function convertTimestampToDateGMT7(time) {
	const timestamp = parseInt(time);
	const date = new Date(timestamp);
	const options = { timeZone: 'Asia/Bangkok', hour12: false };
	const localDate = date.toLocaleString('en-GB', options);
	return localDate.replace(',', '');
}

function convertToLocalDateString(dateString) {
	const year = dateString.substring(0, 4);
	const month = dateString.substring(4, 6) - 1;
	const day = dateString.substring(6, 8);
	const hour = dateString.substring(8, 10);
	const minute = dateString.substring(10, 12);
	const second = dateString.substring(12, 14);

	const date = new Date(year, month, day, hour, minute, second);
	const options = { timeZone: 'Asia/Bangkok', hour12: false };
	const localDate = date.toLocaleString('en-GB', options);
	return localDate.replace(',', '');
}

function getParamsFromUrl(url) {
	const params = {};
	const regex = /[?&]([^=#]+)=([^&#]*)/g;
	let match;

	while ((match = regex.exec(url)) !== null) {
		const key = decodeURIComponent(match[1]);
		let value = decodeURIComponent(match[2]);
		value = value.replace(/\+/g, ' ');
		params[key] = value;
	}

	return params;
}

// URL checking functionality
function checkURL() {
	const url = document.getElementById('urlReturn').value;
	console.log('URL:', url);

	const urlParams = getParamsFromUrl(url);
	const momoParam = urlParams['partnerCode'];
	const vnpayParam = urlParams['vnp_TmnCode'];

	let paymentData;
	if (momoParam) {
		paymentData = parsePaymentData('momo', urlParams);
	} else if (vnpayParam) {
		paymentData = parsePaymentData('vnpay', urlParams);
	}

	if (paymentData) {
		updatePaymentView(paymentData);
	}
}