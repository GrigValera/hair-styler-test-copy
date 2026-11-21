// Подключаем основные стили.

import './styles/main.scss';

// Подключаем модули управления презентацией.

import { initSlides } from './scripts/slides.js';
import { initWheel } from './scripts/wheel.js';

// Инициализируем управление слайдами.

const slides = initSlides();

// Инициализируем боковое колесо навигации.

initWheel(slides);