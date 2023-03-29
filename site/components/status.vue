<template>
  <v-card
    v-if="value"
    width="280"
    height="180"
  >
    <v-sheet height="46" :color="color">
      <h2 class="text-center white--text">
        {{ value.name }}
      </h2>
      <v-progress-linear
        v-if="thinking"
        color="white"
        indeterminate
        height="8"
        striped
      />
    </v-sheet>

    <div>
      <!-- <v-card-text>
        <v-progress-linear
          :active="thinking"
          color="white"
          indeterminate
          rounded
          height="6"
        />
      </v-card-text> -->
      <div v-if="value.waitingForBid">
        <h3 class="text-center">
          Waiting for bid
        </h3>
      </div>
      <div v-else>
        <div class="text-center">
          <div v-if="value.bid">
            <span class="text-h5">{{ value.bid }}</span>
            <span v-if="value.trump">on</span>
            <span v-if="value.trump" class="text-h5">{{ value.trump }}</span>
          </div>
        </div>
      </div>
      <div v-if="value.waitingForTrump">
        <h3 class="text-center">
          Waiting for trump
        </h3>
      </div>
      <div v-if="value.waitingForPlay">
        <h3 class="text-center">
          Thinking
        </h3>
      </div>
      <v-card-actions v-if="value.play">
        <!-- <v-badge
          v-model="winner"
          color="yellow"
          overlap
        > -->
        <v-img
          :src="`/${value.play}.png`"
          contain
          max-height="80"
        />
        <!-- </v-badge> -->
      </v-card-actions>
    </div>
  </v-card>
</template>
<script>
export default {
  props: {
    // The "status" object
    value: {
      type: Object,
      default: null
    },
    color: {
      type: String,
      default: ''
    }
  },

  data () {
    return {
    }
  },

  computed: {
    thinking () {
      return this.value && (
        this.value.waitingForBid ||
        this.value.waitingForTrump ||
        this.value.waitingForPlay)
    },
    winner () {
      return this.value.trickWinner
    }
  },

  watch: {
  },

  created () {
  },

  methods: {
  }
}
</script>
