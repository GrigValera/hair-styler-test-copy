// ========================================
// УПРАВЛЕНИЕ КОЛЕСОМ НАВИГАЦИИ
// ========================================

export function initWheel(slides) {
  // Проверяем наличие модуля управления слайдами.

  if (!slides) {
    return;
  }

  // Определяем индексы слайдов по типам кнопок.

  const slideIndexes = {
    hairdryer: 0,
    feather: 1,
    motor: 2
  };

  // Находим кнопки боковой навигации.

  const buttons = document.querySelectorAll(
    '.slide-01__wheel-button, ' +
    '.slide-02__wheel-button, ' +
    '.slide-03__wheel-button'
  );

  buttons.forEach((button) => {
    // Определяем назначение кнопки по имени иконки.

    const image = button.querySelector('img');

    if (!image) {
      return;
    }

    const source = image.getAttribute('src') || '';

    const iconName = source
      .split('/')
      .pop()
      .replace('.svg', '');

    const slideIndex = slideIndexes[iconName];

    if (slideIndex === undefined) {
      return;
    }

    // Проверяем наличие соответствующего слайда.

    const availableSlides = document.querySelectorAll(
      '[data-slide]'
    );

    if (!availableSlides[slideIndex]) {
      return;
    }

    // Разблокируем кнопку доступного слайда.

    button.disabled = false;

    // Подключаем переход по нажатию на кнопку.

    button.addEventListener('click', () => {
      if (!slides.isDesktop()) {
        return;
      }

      slides.goTo(slideIndex, true);
    });
  });
}