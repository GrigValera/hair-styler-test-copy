// ========================================
// УПРАВЛЕНИЕ СЛАЙДАМИ ПРЕЗЕНТАЦИИ
// ========================================

export function initSlides() {
  const slides = Array.from(
    document.querySelectorAll('[data-slide]')
  );

  const desktopMedia = window.matchMedia(
    '(min-width: 768px)'
  );

  const reducedMotionMedia = window.matchMedia(
    '(prefers-reduced-motion: reduce)'
  );

  // Продолжительность анимации соответствует CSS.

  const animationDuration = 600;

  // Минимальное накопленное движение скролла.

  const wheelThreshold = 35;

  // Интервал завершения жеста прокрутки.

  const wheelIdleDelay = 180;

  let currentIndex = 0;

  let animationTimer = null;
  let wheelTimer = null;

  let isAnimating = false;
  let wheelLocked = false;

  let wheelDelta = 0;

  // ======================================
  // ПРОВЕРКА РЕЖИМА ОТОБРАЖЕНИЯ
  // ======================================

  function isDesktop() {
    return desktopMedia.matches;
  }

  // ======================================
  // ОБНОВЛЕНИЕ ВИДИМОСТИ СЛАЙДОВ
  // ======================================

  function render(
    animate = false,
    direction = 1
  ) {
    window.clearTimeout(animationTimer);

    const shouldAnimate =
      isDesktop() &&
      animate &&
      !reducedMotionMedia.matches;

    isAnimating = shouldAnimate;

    slides.forEach((slide, index) => {
      const isActive = index === currentIndex;

      slide.classList.remove(
        'is-entering',
        'is-forward',
        'is-backward'
      );

      // На десктопе отображаем текущий слайд.
      // На мобильных сохраняем обычный поток.

      slide.hidden = isDesktop() && !isActive;

      slide.classList.toggle(
        'is-active',
        isActive
      );

      if (isActive && shouldAnimate) {
        slide.classList.add(
          'is-entering',
          direction > 0
            ? 'is-forward'
            : 'is-backward'
        );
      }
    });

    // Снимаем блокировку после завершения
    // анимации текущего слайда.

    if (shouldAnimate) {
      animationTimer = window.setTimeout(() => {
        slides[currentIndex]?.classList.remove(
          'is-entering',
          'is-forward',
          'is-backward'
        );

        isAnimating = false;
      }, animationDuration);
    }
  }

  // ======================================
  // ПЕРЕХОД К ВЫБРАННОМУ СЛАЙДУ
  // ======================================

  function goTo(index, moveFocus = false) {
    if (!isDesktop() || isAnimating) {
      return false;
    }

    if (
      !Number.isInteger(index) ||
      index < 0 ||
      index >= slides.length ||
      index === currentIndex
    ) {
      return false;
    }

    const direction =
      index > currentIndex ? 1 : -1;

    currentIndex = index;

    render(true, direction);

    // Переносим фокус после перехода
    // по кнопке или клавиатуре.

    if (moveFocus) {
      slides[currentIndex]
        ?.querySelector('[aria-current="step"]')
        ?.focus({
          preventScroll: true
        });
    }

    // Передаём информацию о смене слайда.
    // Это событие будет использовать колесо.

    document.dispatchEvent(
      new CustomEvent('slide:change', {
        detail: {
          index: currentIndex,
          direction
        }
      })
    );

    return true;
  }

  // ======================================
  // СЛЕДУЮЩИЙ И ПРЕДЫДУЩИЙ СЛАЙДЫ
  // ======================================

  function next() {
    return goTo(currentIndex + 1);
  }

  function prev() {
    return goTo(currentIndex - 1);
  }

  function getCurrentIndex() {
    return currentIndex;
  }

  // ======================================
  // НОРМАЛИЗАЦИЯ СКРОЛЛА
  // ======================================

  function normalizeWheelDelta(event) {
    let delta = event.deltaY;

    // Некоторые устройства передают
    // движение в строках, а не пикселях.

    if (event.deltaMode === 1) {
      delta *= 16;
    }

    // Обрабатываем прокрутку целыми страницами.

    if (event.deltaMode === 2) {
      delta *= window.innerHeight;
    }

    return delta;
  }

  // ======================================
  // УПРАВЛЕНИЕ МЫШЬЮ И ТАЧПАДОМ
  // ======================================

  function handleWheel(event) {
    // На мобильных устройствах
    // не перехватываем прокрутку.

    if (!isDesktop() || slides.length < 2) {
      return;
    }

    // Не блокируем масштабирование браузера
    // и жесты масштабирования тачпадом.

    if (event.ctrlKey || event.metaKey) {
      return;
    }

    // Игнорируем горизонтальные жесты.

    if (
      Math.abs(event.deltaX) >
      Math.abs(event.deltaY)
    ) {
      return;
    }

    event.preventDefault();

    window.clearTimeout(wheelTimer);

    // Ожидаем завершения текущего жеста,
    // включая инерционную прокрутку тачпада.

    wheelTimer = window.setTimeout(() => {
      wheelLocked = false;
      wheelDelta = 0;
    }, wheelIdleDelay);

    // Не переключаем несколько слайдов
    // за один непрерывный жест.

    if (wheelLocked || isAnimating) {
      wheelLocked = true;
      wheelDelta = 0;

      return;
    }

    const delta = normalizeWheelDelta(event);

    if (delta === 0) {
      return;
    }

    // При изменении направления
    // начинаем накопление заново.

    if (
      wheelDelta !== 0 &&
      Math.sign(wheelDelta) !== Math.sign(delta)
    ) {
      wheelDelta = 0;
    }

    wheelDelta += delta;

    // Отсекаем слишком слабые движения.

    if (Math.abs(wheelDelta) < wheelThreshold) {
      return;
    }

    const direction = Math.sign(wheelDelta);

    wheelLocked = true;
    wheelDelta = 0;

    if (direction > 0) {
      next();
    } else {
      prev();
    }
  }

  // ======================================
  // УПРАВЛЕНИЕ КЛАВИАТУРОЙ
  // ======================================

  function handleKeydown(event) {
    if (!isDesktop() || event.repeat) {
      return;
    }

    if (
      event.altKey ||
      event.ctrlKey ||
      event.metaKey ||
      event.shiftKey
    ) {
      return;
    }

    const target = event.target;

    // Не перехватываем клавиши
    // внутри элементов ввода.

    if (
      target instanceof HTMLElement &&
      target.closest(
        'input, textarea, select, [contenteditable="true"]'
      )
    ) {
      return;
    }

    if (
      event.key === 'ArrowDown' ||
      event.key === 'ArrowRight' ||
      event.key === 'PageDown'
    ) {
      event.preventDefault();

      goTo(currentIndex + 1, true);
    }

    if (
      event.key === 'ArrowUp' ||
      event.key === 'ArrowLeft' ||
      event.key === 'PageUp'
    ) {
      event.preventDefault();

      goTo(currentIndex - 1, true);
    }

    // Переход к первому слайду.

    if (event.key === 'Home') {
      event.preventDefault();

      goTo(0, true);
    }

    // Переход к последнему слайду.

    if (event.key === 'End') {
      event.preventDefault();

      goTo(slides.length - 1, true);
    }
  }

  // ======================================
  // ИЗМЕНЕНИЕ РАЗМЕРА ОКНА
  // ======================================

  function handleResize() {
    window.clearTimeout(animationTimer);
    window.clearTimeout(wheelTimer);

    isAnimating = false;
    wheelLocked = false;
    wheelDelta = 0;

    render();

    if (isDesktop()) {
      window.scrollTo(0, 0);
    }
  }

  // ======================================
  // ПОДКЛЮЧЕНИЕ ОБРАБОТЧИКОВ
  // ======================================

  desktopMedia.addEventListener(
    'change',
    handleResize
  );

  window.addEventListener(
    'keydown',
    handleKeydown
  );

  window.addEventListener(
    'wheel',
    handleWheel,
    {
      passive: false
    }
  );

  // При первоначальной загрузке
  // отображаем первый слайд.

  render();

  // Предоставляем методы управления
  // модулю боковой навигации.

  return {
    goTo,
    next,
    prev,
    isDesktop,
    getCurrentIndex
  };
}