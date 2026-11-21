// ========================================
// УПРАВЛЕНИЕ НАВИГАЦИОННЫМ КОЛЕСОМ
// ========================================

export function initWheel(slides) {
  const wheel = document.querySelector(
    '[data-wheel]'
  );

  if (!wheel || !slides) {
    return;
  }

  const track = wheel.querySelector(
    '.wheel__track'
  );

  const templates = Array.from(
    wheel.querySelectorAll(
      '[data-slide-target]'
    )
  );

  const labels = Array.from(
    wheel.querySelectorAll(
      '[data-wheel-label]'
    )
  );

  if (!track || templates.length !== 3) {
    return;
  }

  // ======================================
  // ПАРАМЕТРЫ ИСХОДНОГО МАКЕТА
  // ======================================

  const geometry = {
    compositionWidth: 1240,

    // Координаты центральной позиции
    // относительно основной композиции.

    centerX: -191.5,
    centerY: 400,

    // Радиусы оригинальной SVG-дуги.

    radiusX: 282.059,
    radiusY: 353.2355,

    // Количество позиций полного колеса.

    slotCount: 18,

    // Размеры кнопок.

    inactiveSize: 74,
    activeSize: 103,

    // Вертикальное смещение колеса
    // на первом слайде согласно Figma.

    firstSlideOffsetY: 235
  };

  const slideCount = templates.length;

  // Шаг между соседними позициями:
  // 360 градусов / 18 = 20 градусов.

  const slotAngle =
    Math.PI * 2 / geometry.slotCount;

  const activeScale =
    geometry.activeSize /
    geometry.inactiveSize;

  let currentIndex =
    slides.getCurrentIndex();

  let currentSlot = currentIndex;

  let activeAnimations = [];

  // ======================================
  // ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ
  // ======================================

  function clamp(value, min, max) {
    return Math.min(
      Math.max(value, min),
      max
    );
  }

  function modulo(value, divisor) {
    return (
      (value % divisor) + divisor
    ) % divisor;
  }

  // Переводим размеры исходного макета
  // в адаптивные контейнерные единицы.

  function design(value) {
    return (
      value /
      geometry.compositionWidth *
      100
    );
  }

  // ======================================
  // СОЗДАНИЕ ПОЛНОГО КОЛЕСА
  // ======================================

  const buttons = [];

  for (
    let slot = 0;
    slot < geometry.slotCount;
    slot += 1
  ) {
    // Последовательность:
    // фен, перо, мотор.
    //
    // Повторяем её шесть раз.

    const slideIndex =
      slot % slideCount;

    const template = templates[slideIndex];

    const button =
      slot < slideCount
        ? template
        : template.cloneNode(true);

    button.dataset.wheelSlot =
      String(slot);

    button.dataset.slideTarget =
      String(slideIndex);

    button.classList.remove(
      'is-current',
      'is-visible'
    );

    button.removeAttribute(
      'aria-current'
    );

    button.tabIndex = -1;

    button.setAttribute(
      'aria-hidden',
      'true'
    );

    if (slot >= slideCount) {
      track.appendChild(button);
    }

    buttons.push(button);
  }

  // ======================================
  // НОРМАЛИЗАЦИЯ ПОЗИЦИЙ КОЛЕСА
  // ======================================

  // Определяем расстояние между позицией
  // кнопки и текущим центром вращения.

  function normalizeDistance(value) {
    const half =
      geometry.slotCount / 2;

    return modulo(
      value + half,
      geometry.slotCount
    ) - half;
  }

  // ======================================
  // НАПРАВЛЕНИЕ ВРАЩЕНИЯ
  // ======================================

  // При переходе по боковой иконке
  // используем кратчайший путь.
  //
  // Нажатая кнопка перемещается
  // непосредственно в центральную точку.

  function getWheelStep(from, to) {
    let difference = to - from;

    const half = slideCount / 2;

    if (difference > half) {
      difference -= slideCount;
    }

    if (difference < -half) {
      difference += slideCount;
    }

    return difference;
  }

  // ======================================
  // ВЕРТИКАЛЬНОЕ ПОЛОЖЕНИЕ КОЛЕСА
  // ======================================

  function getVerticalOffset(index) {

    // Первому слайду соответствует
    // опущенное положение колеса.
    //
    // На втором и третьем слайдах
    // колесо располагается по центру.

    return index === 0
      ? geometry.firstSlideOffsetY
      : 0;
  }

  function getTrackPosition(index) {
    const offset =
      getVerticalOffset(index);

    return `0px ${design(offset)}cqw`;
  }

  // ======================================
  // РАСЧЁТ ЭЛЛИПТИЧЕСКОЙ ТРАЕКТОРИИ
  // ======================================

  function getButtonState(distance) {
    const phase =
      normalizeDistance(distance);

    const absolutePhase =
      Math.abs(phase);

    const angle =
      phase * slotAngle;

    // Координаты рассчитываются
    // по радиусам исходной SVG-дуги.
    //
    // При нулевом угле кнопка находится
    // в крайней правой точке эллипса.

    const x =
      geometry.centerX -
      geometry.radiusX +
      geometry.radiusX *
      Math.cos(angle);

    const y =
      geometry.centerY -
      geometry.radiusY *
      Math.sin(angle);

    // Увеличиваем размер кнопки
    // при приближении к центру.

    const activeProgress = clamp(
      1 - absolutePhase,
      0,
      1
    );

    const scale =
      1 +
      (activeScale - 1) *
      activeProgress;

    // В состоянии покоя полностью
    // видны три основные позиции.
    //
    // Следующие позиции постепенно
    // появляются при движении колеса.

    const opacity = clamp(
      (2 - absolutePhase),
      0,
      1
    );

    return {
      transform:
        `translate3d(` +
        `${design(x)}cqw, ` +
        `${design(y)}cqw, 0) ` +
        `translate(-50%, -50%) ` +
        `scale(${scale})`,

      opacity
    };
  }

  // ======================================
  // ПРИМЕНЕНИЕ ПОЗИЦИИ КНОПКИ
  // ======================================

  function applyButtonState(
    button,
    state
  ) {
    button.style.transform =
      state.transform;

    button.style.opacity =
      String(state.opacity);
  }

  // ======================================
  // ОБНОВЛЕНИЕ АКТИВНЫХ СОСТОЯНИЙ
  // ======================================

  function updateActiveStates(index) {
    buttons.forEach((button) => {
      const slot = Number(
        button.dataset.wheelSlot
      );

      const distance =
        normalizeDistance(
          slot - currentSlot
        );

      const active =
        Math.abs(distance) < 0.001;

      const visible =
        Math.abs(distance) <= 1;

      button.classList.toggle(
        'is-current',
        active
      );

      button.classList.toggle(
        'is-visible',
        visible
      );

      // Повторяющиеся скрытые кнопки
      // не участвуют в навигации
      // с клавиатуры.

      button.tabIndex =
        visible ? 0 : -1;

      if (visible) {
        button.removeAttribute(
          'aria-hidden'
        );
      } else {
        // Убираем фокус со скрытой
        // копии при вращении.

        if (
          document.activeElement === button
        ) {
          button.blur();
        }

        button.setAttribute(
          'aria-hidden',
          'true'
        );
      }

      // Только центральная кнопка
      // считается активной.

      if (active) {
        button.setAttribute(
          'aria-current',
          'step'
        );
      } else {
        button.removeAttribute(
          'aria-current'
        );
      }
    });

    labels.forEach((label) => {
      const labelIndex = Number(
        label.dataset.wheelLabel
      );

      label.classList.toggle(
        'is-current',
        labelIndex === index
      );
    });
  }

  // ======================================
  // ОТМЕНА АКТИВНЫХ АНИМАЦИЙ
  // ======================================

  function cancelAnimations() {
    activeAnimations.forEach(
      (animation) => {
        animation.cancel();
      }
    );

    activeAnimations = [];
  }

  // ======================================
  // СТАТИЧЕСКОЕ СОСТОЯНИЕ КОЛЕСА
  // ======================================

  function render(index) {
    cancelAnimations();

    const difference =
      getWheelStep(
        currentIndex,
        index
      );

    currentSlot += difference;
    currentIndex = index;

    // Устанавливаем вертикальное положение
    // всего навигационного колеса.

    track.style.translate =
      getTrackPosition(index);

    // Устанавливаем положение
    // всех восемнадцати кнопок.

    buttons.forEach((button) => {
      const slot = Number(
        button.dataset.wheelSlot
      );

      const distance =
        slot - currentSlot;

      const state =
        getButtonState(distance);

      applyButtonState(button, state);
    });

    updateActiveStates(index);
  }

  // ======================================
  // СОЗДАНИЕ КАДРОВ ВРАЩЕНИЯ
  // ======================================

  function createKeyframes(
    slot,
    fromSlot,
    toSlot
  ) {
    const frames = [];

    const frameCount = 60;

    // Рассчитываем последовательные
    // точки движения по эллипсу.

    for (
      let frame = 0;
      frame <= frameCount;
      frame += 1
    ) {
      const progress =
        frame / frameCount;

      const animatedSlot =
        fromSlot +
        (toSlot - fromSlot) *
        progress;

      const distance =
        slot - animatedSlot;

      const state =
        getButtonState(distance);

      frames.push({
        offset: progress,

        transform:
          state.transform,

        opacity:
          state.opacity
      });
    }

    return frames;
  }

  // ======================================
  // ВЕРТИКАЛЬНОЕ ДВИЖЕНИЕ ВСЕГО КОЛЕСА
  // ======================================

  function animateTrack(
    fromIndex,
    toIndex,
    options
  ) {
    const fromPosition =
      getTrackPosition(fromIndex);

    const toPosition =
      getTrackPosition(toIndex);

    // Сохраняем конечное положение.

    track.style.translate =
      toPosition;

    if (fromPosition === toPosition) {
      return;
    }

    // Дуга, кнопки и подписи
    // перемещаются вместе.

    const animation = track.animate(
      [
        {
          translate: fromPosition
        },
        {
          translate: toPosition
        }
      ],
      options
    );

    activeAnimations.push(animation);
  }

  // ======================================
  // АНИМАЦИЯ ВРАЩЕНИЯ КОЛЕСА
  // ======================================

  function animateTo(
    index,
    duration,
    easing
  ) {
    if (
      !slides.isDesktop() ||
      !duration ||
      index === currentIndex
    ) {
      render(index);

      return;
    }

    cancelAnimations();

    const previousIndex =
      currentIndex;

    const previousSlot =
      currentSlot;

    const wheelStep =
      getWheelStep(
        previousIndex,
        index
      );

    const nextSlot =
      previousSlot + wheelStep;

    const animationOptions = {
      duration,
      easing,
      fill: 'none'
    };

    // Одновременно изменяем вертикальное
    // положение всей конструкции колеса.

    animateTrack(
      previousIndex,
      index,
      animationOptions
    );

    // Анимируем каждую позицию
    // вдоль общего контура эллипса.

    buttons.forEach((button) => {
      const slot = Number(
        button.dataset.wheelSlot
      );

      const keyframes =
        createKeyframes(
          slot,
          previousSlot,
          nextSlot
        );

      const finalState =
        getButtonState(
          slot - nextSlot
        );

      // Устанавливаем конечные координаты
      // для предотвращения скачка
      // после окончания анимации.

      applyButtonState(
        button,
        finalState
      );

      const animation =
        button.animate(
          keyframes,
          animationOptions
        );

      activeAnimations.push(
        animation
      );
    });

    currentSlot = nextSlot;
    currentIndex = index;

    // Обновляем светлый фон,
    // подпись и доступные кнопки.

    updateActiveStates(index);

    // Удаляем завершённые анимации
    // из списка активных.

    const animations = [
      ...activeAnimations
    ];

    Promise.allSettled(
      animations.map(
        (animation) =>
          animation.finished
      )
    ).then(() => {
      activeAnimations =
        activeAnimations.filter(
          (animation) =>
            !animations.includes(
              animation
            )
        );
    });
  }

  // ======================================
  // УПРАВЛЕНИЕ ВИДИМОСТЬЮ ФОКУСА
  // ======================================

  function enableKeyboardNavigation(
    event
  ) {
    const navigationKeys = [
      'Tab',
      'ArrowUp',
      'ArrowDown',
      'ArrowLeft',
      'ArrowRight',
      'PageUp',
      'PageDown',
      'Home',
      'End',
      'Enter',
      ' '
    ];

    if (
      navigationKeys.includes(
        event.key
      )
    ) {
      wheel.classList.add(
        'is-keyboard-navigation'
      );
    }
  }

  function disableKeyboardNavigation() {
    wheel.classList.remove(
      'is-keyboard-navigation'
    );
  }

  // При работе клавиатурой сохраняем
  // визуальный индикатор фокуса.

  window.addEventListener(
    'keydown',
    enableKeyboardNavigation,
    true
  );

  // При использовании мыши
  // или прокрутки скрываем рамку.

  window.addEventListener(
    'pointerdown',
    disableKeyboardNavigation,
    true
  );

  window.addEventListener(
    'wheel',
    disableKeyboardNavigation,
    {
      passive: true,
      capture: true
    }
  );

  // ======================================
  // ПЕРЕКЛЮЧЕНИЕ ПО НАЖАТИЮ НА ИКОНКУ
  // ======================================

  wheel.addEventListener(
    'click',
    (event) => {
      if (
        !slides.isDesktop() ||
        !(event.target instanceof Element)
      ) {
        return;
      }

      const button =
        event.target.closest(
          '[data-slide-target]'
        );

      if (
        !button ||
        !button.classList.contains(
          'is-visible'
        )
      ) {
        return;
      }

      const targetIndex = Number(
        button.dataset.slideTarget
      );

      slides.goTo(
        targetIndex,
        true
      );
    }
  );

  // ======================================
  // СИНХРОНИЗАЦИЯ СО СЛАЙДАМИ
  // ======================================

  document.addEventListener(
    'slide:change',
    (event) => {
      const {
        index,
        duration,
        easing
      } = event.detail;

      animateTo(
        index,
        duration,
        easing
      );
    }
  );

  // Первоначальное состояние колеса.

  render(currentIndex);
}