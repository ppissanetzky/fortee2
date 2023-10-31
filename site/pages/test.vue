<template>
  <div>
    <v-sheet
      color="green"
      width="100%"
      min-height="100vh"
      max-height="100vh"
      class="d-flex flex-column pa-3"
    >
      <v-sheet color="blue" class="d-flex flex-row align-center">
        <span>toolbar</span>
      </v-sheet>
      <v-sheet
        color="white"
        class="d-flex flex-row flex-grow-1"
        min-height="0px"
      >
        <v-sheet
          color="purple"
          class="d-flex flex-column"
          width="25%"
        >
          <v-sheet
            color="yellow"
            class="d-flex flex-column overflow-y-auto"
          >
            <span v-for="(line, i) in lines" :key="i">
              {{ line }}
            </span>
          </v-sheet>
          <v-sheet color="red">
            <span>The bottom</span>
          </v-sheet>
        </v-sheet>
      </v-sheet>
    </v-sheet>
  </div>
</template>
<script>
export default {
  data () {
    return {
    }
  },
  async fetch () {
  },
  computed: {
    lines () {
      const result = []
      for (let i = 0; i < 20; i++) {
        result.push(`line ${i + 1}`)
      }
      return result
    }
  },
  mounted () {
  },
  methods: {
  }
}
</script>
