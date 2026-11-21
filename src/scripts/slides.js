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

  // Общие параметры анимации.
  // Используются слайдами и колесом.

  const animationDuration = 850;
  const animationEasing = 'cubic-bezier(0.42, 0, 0.58, 1)';

  document.documentElement.style.setProperty(
    '--slide-duration',
    `${animationDuration}ms`
  );

  document.documentElement.style.setProperty(
    '--slide-easing',
    animationEasing
  );

  // Параметры обработки прокрутки.

  const wheelThreshold = 35;
  const wheelIdleDelay = 180;

  let currentIndex = 0;

  let isAnimating = false;
  let wheelLocked = false;

  let wheelDelta = 0;
  let wheelTimer = null;

  let transitionId = 0;

  // Храним активные анимации,
  // чтобы корректно отменять их при смене режима.

  let activeAnimations = [];

  // ======================================
  // ПОЛУЧЕНИЕ ТЕКУЩЕГО СОСТОЯНИЯ
  // ======================================

  function isDesktop() {
    return desktopMedia.matches;
  }

  function getCurrentIndex() {
    return currentIndex;
  }

  function getDuration() {
    return reducedMotionMedia.matches
      ? 0
      : animationDuration;
  }

  // ======================================
  // ПОЛУЧЕНИЕ КОМПОЗИЦИИ СЛАЙДА
  // ======================================

  function getComposition(slide) {
    return slide?.querySelector(
      '.slide-01__composition, ' +
      '.slide-02__composition, ' +
      '.slide-03__composition'
    );
  }

  // ======================================
  // ОТМЕНА ТЕКУЩИХ АНИМАЦИЙ
  // ======================================

  function cancelAnimations() {
    transitionId += 1;

    activeAnimations.forEach((animation) => {
      animation.cancel();
    });

    activeAnimations = [];

    isAnimating = false;
  }

  // ======================================
  // ОБНОВЛЕНИЕ ВИДИМОСТИ СЛАЙДОВ
  // ======================================

  function render() {
    const desktop = isDesktop();

    slides.forEach((slide, index) => {
      const active = index === currentIndex;

      slide.classList.remove(
        'is-entering',
        'is-leaving'
      );

      slide.classList.toggle(
        'is-active',
        active
      );

      // На мобильных устройствах
      // сохраняем обычный поток документа.

      slide.hidden = desktop && !active;

      slide.inert = desktop && !active;
    });
  }

  // ======================================
  // УВЕДОМЛЕНИЕ БОКОВОГО КОЛЕСА
  // ======================================

  function notifyWheel(
    previousIndex,
    duration
  ) {
    document.dispatchEvent(
      new CustomEvent('slide:change', {
        detail: {
          previousIndex,
          index: currentIndex,
          duration,
          easing: animationEasing
        }
      })
    );
  }

  // ======================================
  // ПЕРЕКЛЮЧЕНИЕ СЛАЙДОВ
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

    const previousIndex = currentIndex;

    const previousSlide = slides[previousIndex];
    const nextSlide = slides[index];

    const previousComposition =
      getComposition(previousSlide);

    const nextComposition =
      getComposition(nextSlide);

    const direction =
      index > previousIndex ? 1 : -1;

    const duration = getDuration();

    currentIndex = index;

    // Если анимации отключены,
    // переключаем слайд без движения.

    if (
      duration === 0 ||
      !previousComposition ||
      !nextComposition
    ) {
      render();

      notifyWheel(previousIndex, 0);

      if (moveFocus) {
        focusCurrentButton();
      }

      return true;
    }

    isAnimating = true;

    const currentTransition = ++transitionId;

    // Оставляем предыдущий слайд видимым,
    // пока он не завершит движение.

    previousSlide.hidden = false;
    previousSlide.inert = true;

    previousSlide.classList.remove('is-active');
    previousSlide.classList.add('is-leaving');

    // Показываем следующую композицию.

    nextSlide.hidden = false;
    nextSlide.inert = true;

    nextSlide.classList.add(
      'is-active',
      'is-entering'
    );

    // Вычисляем расстояние перемещения
    // относительно высоты области просмотра.

    const transitionDistance =
      document.documentElement.clientHeight;

    const startOffset =
      transitionDistance * direction;

    const endOffset = -startOffset;

    const animationOptions = {
      duration,
      easing: animationEasing,
      fill: 'both'
    };

    // Уходящая композиция плавно
    // покидает область просмотра.

    const leaveAnimation =
      previousComposition.animate(
        [
          {
            transform: 'translateY(0)'
          },
          {
            transform: `translateY(${endOffset}px)`
          }
        ],
        animationOptions
      );

    // Новая композиция одновременно
    // перемещается в центр экрана.

    const enterAnimation =
      nextComposition.animate(
        [
          {
            transform: `translateY(${startOffset}px)`
          },
          {
            transform: 'translateY(0)'
          }
        ],
        animationOptions
      );

    activeAnimations = [
      leaveAnimation,
      enterAnimation
    ];

    // Одновременно запускаем перемещение
    // иконок навигационного колеса.

    notifyWheel(previousIndex, duration);

    // Ожидаем завершения обеих анимаций.

    Promise.allSettled(
      activeAnimations.map(
        (animation) => animation.finished
      )
    ).then(() => {
      // Игнорируем отменённые переходы.

      if (currentTransition !== transitionId) {
        return;
      }

      // Сначала скрываем уходящий слайд,
      // затем очищаем временные анимации.

      render();

      activeAnimations.forEach((animation) => {
        animation.cancel();
      });

      activeAnimations = [];

      isAnimating = false;

      if (moveFocus) {
        focusCurrentButton();
      }
    });

    return true;
  }

  // ======================================
  // УПРАВЛЕНИЕ ФОКУСОМ
  // ======================================

  function focusCurrentButton() {
    document.querySelector(
      '.wheel__button[aria-current="step"]'
    )?.focus({
      preventScroll: true
    });
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

  // ======================================
  // НОРМАЛИЗАЦИЯ ПРОКРУТКИ
  // ======================================

  function normalizeWheelDelta(event) {
    let delta = event.deltaY;

    if (event.deltaMode === 1) {
      delta *= 16;
    }

    if (event.deltaMode === 2) {
      delta *= window.innerHeight;
    }

    return delta;
  }

  // ======================================
  // УПРАВЛЕНИЕ МЫШЬЮ И ТАЧПАДОМ
  // ======================================

  function handleWheel(event) {
    if (!isDesktop() || slides.length < 2) {
      return;
    }

    // Не перехватываем масштабирование браузера.

    if (event.ctrlKey || event.metaKey) {
      return;
    }

    // Игнорируем горизонтальную прокрутку.

    if (
      Math.abs(event.deltaX) >
      Math.abs(event.deltaY)
    ) {
      return;
    }

    const delta = normalizeWheelDelta(event);

    if (delta === 0) {
      return;
    }

    if (event.cancelable) {
      event.preventDefault();
    }

    window.clearTimeout(wheelTimer);

    // Определяем завершение жеста,
    // включая инерционную прокрутку тачпада.

    wheelTimer = window.setTimeout(() => {
      wheelLocked = false;
      wheelDelta = 0;
    }, wheelIdleDelay);

    // Блокируем повторные переключения
    // во время текущего движения.

    if (wheelLocked || isAnimating) {
      wheelLocked = true;
      wheelDelta = 0;

      return;
    }

    // При смене направления
    // начинаем накопление заново.

    if (
      wheelDelta !== 0 &&
      Math.sign(wheelDelta) !== Math.sign(delta)
    ) {
      wheelDelta = 0;
    }

    wheelDelta += delta;

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

    if (
      target instanceof HTMLElement &&
      target.closest(
        'input, textarea, select, [contenteditable="true"]'
      )
    ) {
      return;
    }

    let targetIndex = null;

    switch (event.key) {
      case 'ArrowDown':
      case 'ArrowRight':
      case 'PageDown':
        targetIndex = currentIndex + 1;
        break;

      case 'ArrowUp':
      case 'ArrowLeft':
      case 'PageUp':
        targetIndex = currentIndex - 1;
        break;

      case 'Home':
        targetIndex = 0;
        break;

      case 'End':
        targetIndex = slides.length - 1;
        break;

      default:
        return;
    }

    event.preventDefault();

    goTo(targetIndex, true);
  }

  // ======================================
  // СМЕНА РЕЖИМА ОТОБРАЖЕНИЯ
  // ======================================

  function handleResize() {
    cancelAnimations();

    window.clearTimeout(wheelTimer);

    wheelLocked = false;
    wheelDelta = 0;

    render();

    notifyWheel(currentIndex, 0);

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

  reducedMotionMedia.addEventListener(
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

  // Первоначальное состояние презентации.

  render();

  // Предоставляем методы управления
  // модулю бокового колеса.

  return {
    goTo,
    next,
    prev,
    isDesktop,
    getCurrentIndex
  };
}