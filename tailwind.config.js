/** @type {import('tailwindcss').Config} */
module.exports = {
    content: [
        "./index.html",
        "./home/index.html",
        "./ai/index.html",
        "./insights/index.html",
        "./business/index.html",
        "./profile/index.html",
        "./front_end/**/*.js"
    ],
    theme: {
        extend: {
            colors: {
                primary: '#0077b6',
                secondary: '#00b4d8',
                accent: '#90e0ef',
            }
        },
    },
    plugins: [],
}
